/**
 * LE rendu de l'arbitre — la projection visuelle de `PlayerOverlay`, une
 * seule fois pour le lecteur web, le lecteur de bureau et (par substitution)
 * le téléviseur LG. Aucune décision ici : qui s'affiche, quand et avec quel
 * décompte est tranché par l'arbitre partagé (`usePlaybackOverlay`).
 *
 * Trois surfaces possibles, jamais deux à la fois :
 *  - le bouton de saut blanc (`SkipSegmentButton`), qui sert AUSSI de pilule
 *    « aller à l'épisode suivant » — un seul dessin pour un seul geste ;
 *  - la carte « à suivre » du générique (`UpNextCard`) ;
 *  - l'affiche pleine de fin (`NextEpisodeFullscreen` — désormais sur le web
 *    aussi, qui n'avait AUCUN écran de fin).
 * Les deux dernières gardent leurs entrées Framer Motion (surfaces
 * existantes) ; le bouton, lui, est en CSS pur.
 */

import { AnimatePresence } from "framer-motion";
import type { PlayerOverlay } from "@tentacle-tv/shared";
import { SkipSegmentButton } from "./SkipSegmentButton";
import { UpNextCard } from "./UpNextCard";
import { NextEpisodeFullscreen } from "./NextEpisodeFullscreen";

interface PlaybackOverlayProps {
  overlay: PlayerOverlay;
  countdownTotals: { skipMs: number; nextMs: number };
  /** Saut manuel (bouton) — l'automatique vit dans la coquille. */
  onSkip: () => void;
  /** La croix de l'overlay courant (bouton, carte ou affiche). */
  onDismiss: () => void;
  /** « Lire maintenant » de la carte et de l'affiche. */
  onPlayNow: () => void;
  /** Couche du bouton de saut : `z-50` web, `z-20` bureau (mpv). */
  layer?: string;
  /** La barre de contrôles est-elle à l'écran ? (le bouton lui cède la place). */
  controlsVisible?: boolean;
  /**
   * Un panneau du lecteur (pistes, épisodes) est ouvert : pilules et carte
   * s'EFFACENT — ils partagent le coin bas-droit et la même couche, et le
   * panneau a la priorité. Ils reviennent à la fermeture ; l'affiche pleine de
   * fin, elle, n'est pas concernée (plus de panneau possible à ce moment-là).
   */
  panelOpen?: boolean;
  nextEpisodeTitle?: string;
  nextEpisodeDescription?: string;
  nextEpisodeImageUrl?: string;
  nextSeriesBackdropUrl?: string;
  nextEpisodeThumbUrl?: string;
}

export function PlaybackOverlay({
  overlay, countdownTotals, onSkip, onDismiss, onPlayNow, layer = "z-20",
  controlsVisible, panelOpen = false,
  nextEpisodeTitle, nextEpisodeDescription, nextEpisodeImageUrl,
  nextSeriesBackdropUrl, nextEpisodeThumbUrl,
}: PlaybackOverlayProps) {
  return (
    <>
      {overlay.kind === "skip" && !panelOpen && (
        <SkipSegmentButton
          key={overlay.segmentType}
          labelKey={overlay.labelKey}
          countdownSeconds={overlay.countdownSeconds}
          countdownTotalMs={countdownTotals.skipMs}
          onSkip={onSkip}
          // En sourdine, la croix n'a plus d'office : le bouton n'est déjà
          // plus sur l'image, il n'existe que le temps de l'habillage.
          onDismiss={overlay.dismissible ? onDismiss : undefined}
          layer={layer}
          controlsVisible={controlsVisible}
        />
      )}
      {/* La pilule « aller à l'épisode suivant » — MÊME bouton que les sauts, et
          désormais MÊME règle : elle se montre tant qu'on ne l'a pas refusée,
          puis se retire de l'image nue. Sa croix vaut refus de LA SUITE, le
          même que celui de la carte. */}
      {overlay.kind === "nextButton" && !panelOpen && (
        <SkipSegmentButton
          labelKey="goToNextEpisode"
          countdownSeconds={null}
          countdownTotalMs={countdownTotals.nextMs}
          onSkip={onPlayNow}
          onDismiss={overlay.dismissible ? onDismiss : undefined}
          layer={layer}
          controlsVisible={controlsVisible}
        />
      )}
      <AnimatePresence>
        {overlay.kind === "nextCard" && !overlay.final && !panelOpen && (
          <UpNextCard
            countdown={overlay.countdownSeconds}
            totalSeconds={countdownTotals.nextMs / 1000}
            episodeTitle={nextEpisodeTitle}
            episodeDescription={nextEpisodeDescription}
            episodeImageUrl={nextEpisodeImageUrl}
            onPlay={onPlayNow}
            onDismiss={onDismiss}
            controlsVisible={controlsVisible}
          />
        )}
        {overlay.kind === "nextCard" && overlay.final && (
          <NextEpisodeFullscreen
            countdown={overlay.countdownSeconds}
            totalSeconds={countdownTotals.nextMs / 1000}
            episodeTitle={nextEpisodeTitle}
            episodeDescription={nextEpisodeDescription}
            // Sans bannière de série (web, LG), la vignette de l'épisode fait
            // un fond tout aussi juste — assombrie par le composant lui-même.
            seriesBackdropUrl={nextSeriesBackdropUrl ?? nextEpisodeImageUrl}
            episodeThumbUrl={nextEpisodeThumbUrl ?? nextEpisodeImageUrl}
            onPlayNow={onPlayNow}
            onDismiss={onDismiss}
          />
        )}
      </AnimatePresence>
    </>
  );
}
