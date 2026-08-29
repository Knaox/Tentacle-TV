import { useCallback, useMemo } from "react";
import {
  useAutoplayConfig,
  usePlaybackOverlay,
  usePlaybackSegments,
  type PlaybackOverlayResult,
} from "@tentacle-tv/api-client";
import type { MediaItem, PlayerOverlay } from "@tentacle-tv/shared";
import { useNextEpisodeMedia } from "./useNextEpisodeMedia";
import type { AutoPlayCtx } from "../components/player/TVAutoPlaySwitch";

/**
 * L'arbitre de lecture partagé, câblé pour le téléviseur.
 *
 * Rien de ce qui DÉCIDE n'est ici : le seuil, le minuteur, l'escalade de la
 * carte vers l'écran de fin, le refus mémorisé — tout cela vit dans les
 * réducteurs partagés, et le téléviseur les lit comme les cinq autres
 * surfaces. Ce fichier est un plan de câblage, plus un ADAPTATEUR.
 *
 * # L'adaptateur, et pourquoi il vaut mieux qu'une réécriture
 *
 * Les surfaces « épisode suivant » du téléviseur (bannière, écran de fin) sont
 * déjà écrites, déjà focusables, déjà éprouvées à la télécommande. Elles
 * consomment un `AutoPlayCtx`. Plutôt que de les rouvrir, on leur SERT ce
 * contrat depuis l'arbitre : `source` vient du genre d'overlay, `countdown` de
 * son décompte, « lire maintenant » et la croix de la coquille. Le moteur
 * change, la vue ne bouge pas — et le routage du bouton Retour, qui lit ce
 * même contrat, garde ses garanties.
 *
 * `startAutoPlay` n'a plus de sens : personne n'arme plus rien à la main,
 * c'est l'arbitre qui décide quand la carte paraît. Il reste dans le contrat
 * (la vue le déclare) et ne fait rien.
 */
export interface TVPlaybackOverlay extends PlaybackOverlayResult {
  autoPlay: AutoPlayCtx;
  /** Interrupteur admin « Déclenchement auto-play » — lu par la sortie de fin. */
  autoplayEnabled: boolean;
  /** Miroir synchrone lu par le routage Retour, au sein du même dispatch. */
  surfaceRef: { readonly current: PlayerOverlay };
}

export function useTVPlaybackOverlay(args: {
  itemId: string;
  item: MediaItem | undefined;
  /** Position AFFICHÉE (secondes) et durée du média. */
  displayTime: number;
  displayDuration: number;
  hasStarted: boolean;
  /** Le média est allé au bout (onEnd natif ou détecteur de stagnation). */
  ended: boolean;
  /** Pendant un scrub, aucune surcouche ne paraît et le décompte se suspend. */
  scrubbing: boolean;
  onSeek: (seconds: number) => void;
  navigateToEpisode: (episodeId: string) => void;
  /** Plus rien à proposer : retour à la fiche média. */
  onFinished: () => void;
}): TVPlaybackOverlay {
  const {
    itemId, item, displayTime, displayDuration, hasStarted, ended, scrubbing,
    onSeek, navigateToEpisode, onFinished,
  } = args;

  const segments = usePlaybackSegments(itemId);
  const media = useNextEpisodeMedia(item);
  const { data: autoplayConfig } = useAutoplayConfig(true);

  const nextEpisodeId = media.nextEpisode?.Id;
  const allerAuSuivant = useCallback(() => {
    if (nextEpisodeId) navigateToEpisode(nextEpisodeId);
  }, [nextEpisodeId, navigateToEpisode]);

  const playback = usePlaybackOverlay({
    itemId,
    isEpisode: item?.Type === "Episode",
    hasNextEpisode: !!media.nextEpisode,
    positionSeconds: displayTime,
    durationSeconds: displayDuration,
    hasStarted,
    playbackEnded: ended,
    segments: segments.segments,
    runtimeMs: segments.runtimeMs,
    serverAutoplayEnabled: autoplayConfig?.enabled ?? true,
    scrubbing,
    onSeekSeconds: onSeek,
    onNextEpisode: allerAuSuivant,
    onEndOfPlayback: onFinished,
  });

  const { overlay, overlayRef, playNow, dismissOverlay } = playback;

  const autoPlay = useMemo<AutoPlayCtx>(() => ({
    countdown: overlay.kind === "nextCard" ? overlay.countdownSeconds : null,
    source:
      overlay.kind === "nextCard" ? (overlay.final ? "eof" : "credits") : null,
    ...media,
    navigateToNextEpisode: playNow,
    // L'arbitre décide seul de l'apparition : plus rien à armer à la main.
    startAutoPlay: () => undefined,
    cancelAutoPlay: dismissOverlay,
  }), [overlay, media, playNow, dismissOverlay]);

  return {
    ...playback,
    autoPlay,
    autoplayEnabled: autoplayConfig?.enabled ?? true,
    surfaceRef: overlayRef,
  };
}
