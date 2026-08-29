/**
 * La projection de l'ARBITRE, version téléviseur LG — le pendant du
 * `PlaybackOverlay` web, avec ce qui change à trois mètres : l'ancrage
 * d'overscan (classes `.saut-tv`, `.carte-next-tv`, `.affiche-fin-tv`),
 * la prise de focus quand l'habillage s'est éteint, et le refus en SECOND
 * BOUTON plutôt qu'en croix (une cible de trente-deux pixels ne se vise pas
 * à la télécommande). Aucune décision ici non plus : qui s'affiche, quand et
 * avec quel décompte vient de la coquille partagée, comme partout.
 *
 * L'affiche de fin garde la règle historique : la refuser, c'est en avoir
 * fini — l'épisode est terminé, la masquer laisserait un écran noir sans
 * commande. On quitte donc le lecteur.
 */

import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { PlayerOverlay } from "@tentacle-tv/shared";
import { UpNextCard } from "@/components/player/UpNextCard";
import { NextEpisodeFullscreen } from "@/components/player/NextEpisodeFullscreen";
import { giveFocus } from "../focus/active";
import { destinationEntreeDeZone } from "../focus/zones";
import { readState, useTvPlayerState } from "@tentacle-tv/tv-core";
import { poserFocusOsd } from "./focusOsd";
import { exitPlayer } from "./playerExitTv";
import { OVERLAY_ATTRIBUTE } from "./okOverlay";

interface TvProps {
  overlay: PlayerOverlay;
  countdownTotals: { skipMs: number; nextMs: number };
  onSkip: () => void;
  onDismiss: () => void;
  onPlayNow: () => void;
  nextEpisodeTitle?: string;
  nextEpisodeDescription?: string;
  nextEpisodeImageUrl?: string;
  nextSeriesBackdropUrl?: string;
  nextEpisodeThumbUrl?: string;
}

/**
 * L'appel à l'action de l'affiche, et non sa croix de fermeture : la croix est
 * posée en absolu sur la racine, les boutons du panneau sont plus profonds.
 */
function mainAction(racine: HTMLElement): HTMLElement | null {
  for (const button of racine.querySelectorAll<HTMLElement>("button")) {
    if (button.parentElement !== racine) return button;
  }
  return null;
}

/** Prend le focus si personne d'autre ne s'en sert, le rend à l'habillage après. */
function useOverlayFocus(
  ref: { current: HTMLElement | null },
  active: boolean,
  target: (racine: HTMLElement) => HTMLElement | null,
  imposer = false,
) {
  useEffect(() => {
    const racine = ref.current;
    if (!active || !racine) return;
    if (!imposer && readState().mode !== "idle") return;
    const element = target(racine);
    if (element) giveFocus(element);
    return () => {
      if (!racine.contains(document.activeElement)) return;
      const focal = document.activeElement;
      if (focal instanceof HTMLElement) focal.blur();
      poserFocusOsd(document.querySelector<HTMLElement>(".osd-tv"));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, imposer]);
}

export function PlaybackOverlayTv({
  overlay, countdownTotals, onSkip, onDismiss, onPlayNow,
  nextEpisodeTitle, nextEpisodeDescription, nextEpisodeImageUrl,
  nextSeriesBackdropUrl, nextEpisodeThumbUrl,
}: TvProps) {
  const { t } = useTranslation("player");
  const state = useTvPlayerState();
  const skipRef = useRef<HTMLDivElement>(null);
  const refCarte = useRef<HTMLDivElement>(null);
  const refAffiche = useRef<HTMLDivElement>(null);

  const isSkip = overlay.kind === "skip";
  const estCarte = overlay.kind === "nextCard" && !overlay.final;
  const estAffiche = overlay.kind === "nextCard" && overlay.final;

  // Rien pendant le déplacement — l'écran du curseur fantôme est un mode, on y
  // cherche une position. L'affiche de fin, elle, a raison même là : il n'y a
  // plus de position à chercher.
  const efface = state.mode === "scrub" && !estAffiche;

  useOverlayFocus(skipRef, isSkip && !efface, (r) => r.querySelector("button"));
  useOverlayFocus(refCarte, estCarte && !efface, destinationEntreeDeZone);
  // L'affiche recouvre tout, l'habillage compris : le focus s'impose, sur
  // « Lire maintenant » plutôt que sur la croix qui la précède dans le document.
  useOverlayFocus(
    refAffiche,
    estAffiche,
    (r) => mainAction(r) ?? destinationEntreeDeZone(r),
    true,
  );

  if (efface || overlay.kind === "none") return null;

  if (overlay.kind === "skip") {
    const armed = overlay.countdownSeconds !== null;
    const label = armed
      ? t(`player:${overlay.labelKey}In`, { seconds: overlay.countdownSeconds })
      : t(`player:${overlay.labelKey}`);
    const skip = (
      <button
        type="button"
        className="saut-tv"
        {...{ [OVERLAY_ATTRIBUTE]: "" }}
        onClick={(e) => { e.stopPropagation(); onSkip(); }}
      >
        {label}
      </button>
    );
    // Hors décompte, le bouton reste seul, à sa place. L'îlot n'apparaît que
    // le temps du décompte, avec le refus en second bouton.
    if (!armed) return <div ref={skipRef}>{skip}</div>;
    return (
      <div ref={skipRef} className="saut-tv-ilot">
        {skip}
        <button
          type="button"
          className="saut-tv saut-tv--refus"
          {...{ [OVERLAY_ATTRIBUTE]: "" }}
          onClick={(e) => { e.stopPropagation(); onDismiss(); }}
        >
          {t("player:dismiss")}
        </button>
      </div>
    );
  }

  if (estCarte) {
    return (
      <div className="carte-suivant-tv" ref={refCarte} {...{ [OVERLAY_ATTRIBUTE]: "" }}>
        <UpNextCard
          countdown={overlay.countdownSeconds}
          totalSeconds={countdownTotals.nextMs / 1000}
          episodeTitle={nextEpisodeTitle}
          episodeDescription={nextEpisodeDescription}
          episodeImageUrl={nextEpisodeImageUrl}
          onPlay={onPlayNow}
          onDismiss={onDismiss}
        />
      </div>
    );
  }

  return (
    <div className="affiche-fin-tv" ref={refAffiche} {...{ [OVERLAY_ATTRIBUTE]: "" }}>
      <NextEpisodeFullscreen
        countdown={overlay.countdownSeconds}
        totalSeconds={countdownTotals.nextMs / 1000}
        episodeTitle={nextEpisodeTitle}
        episodeDescription={nextEpisodeDescription}
        seriesBackdropUrl={nextSeriesBackdropUrl ?? nextEpisodeImageUrl}
        episodeThumbUrl={nextEpisodeThumbUrl ?? nextEpisodeImageUrl}
        onPlayNow={onPlayNow}
        onDismiss={() => {
          onDismiss();
          exitPlayer();
        }}
      />
    </div>
  );
}
