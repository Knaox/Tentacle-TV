/**
 * Le lecteur COMPLET des bandes-annonces (web, bureau) : une vraie lecture,
 * sur toute la fenêtre, sans publicité — chaque vidéo YouTube ou Dailymotion
 * passe par le relais du serveur, jamais stockée.
 *
 * Il joue une FILE, dans l'ordre que le serveur a choisi : à la fin, la
 * suivante, sinon il se ferme. Un échec suit `trailerFailureStep` (shared) :
 * le serveur bride YouTube → le lecteur officiel pour cette bande-annonce,
 * avec une ligne qui le dit ; une lecture qui échoue → la suivante, puis le
 * lecteur officiel (YouTube) ou la fermeture (Dailymotion n'a pas de repli
 * sans publicité). Échap sort du plein écran, puis ferme le lecteur — jamais
 * la fiche dessous.
 *
 * Porté au-dessus de tout (`createPortal`), sous la bande de titre du bureau
 * (`--hote-bandeau`, macOS) qui reste à sa place. Il couvre la page : aucun
 * aperçu au survol ne peut partir dessous.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import {
  trailerFailureStep, trailerItemKey, trailerNeighborIndex, trailerPublicUrl, type TrailerQueueItem,
} from "@tentacle-tv/shared";
import { BackIcon } from "../PlayerIcons";
import { TrailerEmbedFallback } from "../detail/TrailerEmbedFallback";
import { ExternalLinkIcon } from "../media/MediaDetailIcons";
import { externalLinkHandler } from "../../lib/openExternal";
import { TrailerStage } from "./TrailerStage";
import { useTrailerFullscreen } from "./useTrailerFullscreen";
import { useTrailerKeys } from "./useTrailerKeys";

export interface TrailerPlayerProps {
  queue: readonly TrailerQueueItem[];
  startIndex?: number;
  /** La langue du serveur (catalogue), pour dire VF / VOSTFR / VO ; `resolve` la redit. */
  language?: string | null;
  onClose: () => void;
}

export function TrailerPlayer({ queue, startIndex = 0, language = null, onClose }: TrailerPlayerProps) {
  const { t } = useTranslation("common");
  const stageRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(() => Math.min(Math.max(0, startIndex), Math.max(0, queue.length - 1)));
  /** Les bandes-annonces jouées par le lecteur officiel, faute de relais. */
  const [embedded, setEmbedded] = useState<ReadonlySet<string>>(() => new Set());
  const item = queue[index];
  const embed = !!item && embedded.has(trailerItemKey(item.playback)) && item.playback.kind === "youtube";
  const { fullscreen, fullscreenRef, toggleFullscreen } = useTrailerFullscreen(stageRef, !!item && !embed);

  useEffect(() => {
    if (!item) onClose();
  }, [item, onClose]);

  const goTo = useCallback((next: number | null) => {
    if (next === null) onClose();
    else setIndex(next);
  }, [onClose]);

  const onNeighbor = useCallback((direction: 1 | -1) => {
    const next = trailerNeighborIndex(index, queue.length, direction);
    if (next !== null) setIndex(next);
  }, [index, queue.length]);

  const onEnded = useCallback(() => goTo(trailerNeighborIndex(index, queue.length, 1)), [goTo, index, queue.length]);

  const onFailure = useCallback((cause: "embed" | "failed") => {
    if (!item) return;
    const step = trailerFailureStep(item.playback, { index, count: queue.length }, cause);
    if (step === "embed") setEmbedded((known) => new Set(known).add(trailerItemKey(item.playback)));
    else goTo(step === "next" ? index + 1 : null);
  }, [item, index, queue.length, goTo]);

  const onEscape = useCallback(() => {
    if (fullscreenRef.current) toggleFullscreen();
    else onClose();
  }, [fullscreenRef, toggleFullscreen, onClose]);

  // Le lecteur officiel garde son propre clavier (dans son cadre) : ici, Échap et la file seulement.
  useTrailerKeys((action) => {
    if (action.kind === "escape") onEscape();
    else if (action.kind === "neighbor") onNeighbor(action.direction);
    else if (action.kind === "toggleFullscreen") toggleFullscreen();
  }, embed);

  if (!item) return null;

  return createPortal(
    <div
      ref={stageRef}
      role="dialog"
      aria-modal="true"
      aria-label={t("common:trailerPlayer")}
      className="fixed inset-x-0 bottom-0 z-[120] bg-black"
      style={{ top: fullscreen ? 0 : "var(--hote-bandeau, 0px)" }}
    >
      {embed && item.playback.kind === "youtube" ? (
        <div className="flex h-full flex-col">
          <div className="flex items-center gap-3 px-3 py-3 sm:px-6">
            <button onClick={onClose} className="rounded-full p-2 hover:bg-white/10" aria-label={t("common:trailerClose")}><BackIcon /></button>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-base font-semibold text-white sm:text-lg">{item.name || t("common:trailer")}</h2>
              <p className="text-xs text-white/60 sm:text-sm">{t("common:trailerEmbedNotice")}</p>
            </div>
            <a
              href={trailerPublicUrl(item.playback)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={externalLinkHandler(trailerPublicUrl(item.playback))}
              className="hidden items-center gap-2 rounded-md border border-white/20 px-3 py-2 text-sm text-white/80 hover:text-white sm:inline-flex"
            >
              <ExternalLinkIcon /> {t("common:openOnSource", { source: "YouTube" })}
            </a>
          </div>
          <TrailerEmbedFallback ytId={item.playback.ytId} title={item.name || t("common:trailer")} className="min-h-0 flex-1" />
        </div>
      ) : (
        <TrailerStage
          key={trailerItemKey(item.playback)}
          item={item} queue={queue} index={index} language={language}
          fullscreen={fullscreen} onToggleFullscreen={toggleFullscreen}
          onFailure={onFailure} onEnded={onEnded} onNeighbor={onNeighbor} onPick={setIndex}
          onEscape={onEscape} onClose={onClose}
        />
      )}
    </div>,
    document.body,
  );
}
