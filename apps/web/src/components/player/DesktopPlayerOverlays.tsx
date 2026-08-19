import type { MutableRefObject } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence } from "framer-motion";
import { LoadingBar } from "./PlayerLoadingScreen";
import { NextEpisodeOverlay } from "../NextEpisodeOverlay";
import { NextEpisodeFullscreen } from "./NextEpisodeFullscreen";
import { useUpNextCard } from "./useUpNextCard";
import { SkipIntroButton } from "./SkipIntroButton";
import { useSkipIntroCountdown } from "./useSkipIntroCountdown";
import type { SegmentTimestamps } from "@tentacle-tv/shared";

interface DesktopPlayerOverlaysProps {
  showLoadingOverlay: boolean;
  buffering: boolean;
  /** Réserve mpv en secondes (`demuxer-cache-duration`) — affichée en debug. */
  buffered: number;
  posterUrl?: string;
  showSkipIntro: boolean | null | undefined;
  showSkipCredits: boolean | null | undefined;
  introSegment?: SegmentTimestamps | null;
  creditsSegment?: SegmentTimestamps | null;
  isDirectPlay: boolean;
  effectiveMpvOffset: MutableRefObject<number>;
  hasNextEpisode?: boolean;
  /** Épisode en cours — réarme la carte « à suivre » au changement de vidéo. */
  itemId?: string;
  autoPlayCountdown: number | null;
  autoPlaySource: "credits" | "eof" | null;
  nextEpisodeTitle?: string;
  nextEpisodeDescription?: string;
  nextEpisodeImageUrl?: string;
  nextSeriesBackdropUrl?: string;
  nextEpisodeThumbUrl?: string;
  seek: (pos: number) => Promise<void>;
  onNextEpisode?: () => void;
  cancelAutoPlay: () => void;
  onAutoNextDismiss?: () => void;
}

/**
 * Overlays du player desktop : chargement (bannière + LoadingBar), spinner de
 * buffering, boutons skip intro/générique, et les deux écrans « épisode
 * suivant » (bannière crédits / affiche pleine EOF). Extraction mécanique.
 *
 * Tout est posé sur la vidéo → text-white/bg-black volontairement en dur,
 * identiques dans les deux thèmes clair/sombre.
 *
 * Et donc PAS de `backdrop-filter` sur les boutons de saut. mpv dessine hors du
 * moteur web — fenêtre native sous la surface de Chromium sur Windows, couche
 * GL sous la webview sur macOS et Linux : le moteur ne voit jamais l'image du
 * film et ne peut pas la flouter. Le flou ne floutait rien et coûtait quand
 * même une couche composée par image. Ne pas le remettre.
 *
 * `NextEpisodeFullscreen`, en revanche, garde le sien : il est posé sur la
 * bannière de la série, donc sur du HTML, où le flou fonctionne vraiment.
 */
export function DesktopPlayerOverlays({
  showLoadingOverlay, buffering, buffered, posterUrl,
  showSkipIntro, showSkipCredits, introSegment, creditsSegment,
  isDirectPlay, effectiveMpvOffset, hasNextEpisode, itemId,
  autoPlayCountdown, autoPlaySource,
  nextEpisodeTitle, nextEpisodeDescription, nextEpisodeImageUrl,
  nextSeriesBackdropUrl, nextEpisodeThumbUrl,
  seek, onNextEpisode, cancelAutoPlay, onAutoNextDismiss,
}: DesktopPlayerOverlaysProps) {
  const { t } = useTranslation("player");
  // Saut d'intro automatique — inerte tant que la préférence est éteinte. La
  // cible se calcule AU MOMENT du saut : `effectiveMpvOffset` est une ref, sa
  // valeur au rendu ne vaut rien.
  const sauterIntro = () => {
    if (!introSegment) return;
    void seek(isDirectPlay ? introSegment.end : Math.max(0, introSegment.end - effectiveMpvOffset.current));
  };
  const sautIntro = useSkipIntroCountdown({
    visible: Boolean(showSkipIntro && introSegment),
    cle: introSegment?.start,
    sauter: sauterIntro,
  });
  // Carte « à suivre » : proposée dès le générique quand un épisode suivant
  // existe (elle remplace alors le bouton texte), puis dotée d'un décompte si
  // l'enchaînement automatique démarre. Partagé avec le lecteur web.
  const upNext = useUpNextCard({
    itemId,
    hasNextEpisode,
    duringCredits: showSkipCredits && Boolean(creditsSegment),
    autoPlayCountdown,
  });

  return (
    <>
      {/* Réserve mpv, paquet instrumenté seulement. Elle est illisible sur la
          seekbar — 8 s de cache sur un film de 2 h 20, c'est 0,1 % de la barre,
          quelques pixels — alors que c'est le seul chiffre qui dise si l'image
          est partie avec de quoi tenir. Ici il se lit pendant le chargement ET
          pendant la lecture. */}
      {(import.meta.env.DEV || __PLAYER_DEBUG__) && (
        <div className="pointer-events-none absolute left-4 top-4 z-30 rounded bg-black/70 px-2 py-1 font-mono text-[11px] text-white/90">
          cache {buffered.toFixed(1)} s{buffering ? " · attente" : ""}
        </div>
      )}

      {/* Loading overlay — initial load + source changes (quality/audio) :
          bannière (backdrop) + barre de chargement, en continuité avec
          PlayerLoadingScreen affiché avant le montage du player. */}
      {showLoadingOverlay && (
        <div className="pointer-events-none absolute inset-0 z-[5]">
          {posterUrl && <img src={posterUrl} className="h-full w-full object-cover" alt="" />}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/30" />
          <div className="absolute inset-x-0 bottom-0 px-8 pb-14 md:px-16 md:pb-20">
            <LoadingBar />
          </div>
        </div>
      )}

      {/* Buffering spinner (during playback — seeking, network stall) */}
      {buffering && !showLoadingOverlay && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/30 border-t-white" />
        </div>
      )}

      {/* Skip intro / credits buttons */}
      {showSkipIntro && introSegment && (
        <SkipIntroButton
          compte={sautIntro.compte}
          onSauter={sauterIntro}
          onAnnuler={sautIntro.annuler}
          couche="z-20"
        />
      )}
      {/* Bouton réservé au cas où il n'y a RIEN après : quand un épisode suit,
          c'est la carte « à suivre » qui prend sa place — avec la vignette et le
          titre, de quoi décider plutôt qu'un simple libellé. */}
      {showSkipCredits && creditsSegment && !autoPlayCountdown && !hasNextEpisode && (
        <button onClick={() => seek(isDirectPlay ? creditsSegment.end : Math.max(0, creditsSegment.end - effectiveMpvOffset.current))}
          className="absolute bottom-28 right-6 z-20 rounded-lg border border-white/20 bg-black/60 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-white/20">
          {t("player:skipCredits")}
        </button>
      )}

      <AnimatePresence>
        {/* `eof` a son propre plein écran, la carte ne doit pas s'y superposer. */}
        {upNext.visible && autoPlaySource !== "eof" && (
          <NextEpisodeOverlay countdown={upNext.countdown} episodeTitle={nextEpisodeTitle}
            episodeDescription={nextEpisodeDescription} episodeImageUrl={nextEpisodeImageUrl}
            onPlayNow={() => onNextEpisode?.()}
            onDismiss={() => {
              if (upNext.countdown !== null) { cancelAutoPlay(); onAutoNextDismiss?.(); }
              upNext.dismiss();
            }} />
        )}
        {autoPlayCountdown !== null && autoPlaySource === "eof" && (
          <NextEpisodeFullscreen countdown={autoPlayCountdown} episodeTitle={nextEpisodeTitle}
            episodeDescription={nextEpisodeDescription} seriesBackdropUrl={nextSeriesBackdropUrl}
            episodeThumbUrl={nextEpisodeThumbUrl}
            onPlayNow={() => onNextEpisode?.()}
            onDismiss={() => { cancelAutoPlay(); onAutoNextDismiss?.(); }} />
        )}
      </AnimatePresence>
    </>
  );
}
