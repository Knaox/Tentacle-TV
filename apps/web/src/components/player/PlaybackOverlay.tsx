/**
 * LE rendu de l'arbitre — la projection visuelle de `PlayerOverlay`, une
 * seule fois pour le lecteur web, le lecteur de bureau et (par substitution)
 * le téléviseur LG. Aucune décision ici : qui s'affiche, quand et avec quel
 * décompte est tranché par l'arbitre partagé (`usePlaybackOverlay`).
 *
 * Trois surfaces possibles, jamais deux à la fois :
 *  - le bouton de saut blanc (`SkipSegmentButton`) ;
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
  couche?: string;
  nextEpisodeTitle?: string;
  nextEpisodeDescription?: string;
  nextEpisodeImageUrl?: string;
  nextSeriesBackdropUrl?: string;
  nextEpisodeThumbUrl?: string;
}

export function PlaybackOverlay({
  overlay, countdownTotals, onSkip, onDismiss, onPlayNow, couche = "z-20",
  nextEpisodeTitle, nextEpisodeDescription, nextEpisodeImageUrl,
  nextSeriesBackdropUrl, nextEpisodeThumbUrl,
}: PlaybackOverlayProps) {
  return (
    <>
      {overlay.kind === "skip" && (
        <SkipSegmentButton
          key={overlay.segmentType}
          labelKey={overlay.labelKey}
          countdownSeconds={overlay.countdownSeconds}
          countdownTotalMs={countdownTotals.skipMs}
          onSkip={onSkip}
          onDismiss={onDismiss}
          couche={couche}
        />
      )}
      <AnimatePresence>
        {overlay.kind === "nextCard" && !overlay.final && (
          <UpNextCard
            countdown={overlay.countdownSeconds}
            totalSeconds={countdownTotals.nextMs / 1000}
            episodeTitle={nextEpisodeTitle}
            episodeDescription={nextEpisodeDescription}
            episodeImageUrl={nextEpisodeImageUrl}
            onPlay={onPlayNow}
            onDismiss={onDismiss}
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
