import { useAutoplayConfig, usePlaybackOverlay } from "@tentacle-tv/api-client";
import type { PlaybackOverlayResult } from "@tentacle-tv/api-client";
import type { PlayerPlayback } from "./usePlayerPlayback";

/**
 * L'arbitre de lecture partagé, câblé pour le mobile.
 *
 * Il n'y a rien de mobile dans les DÉCISIONS — quel passage proposer, quand
 * décompter, quand enchaîner : tout cela vit dans la coquille commune
 * (`usePlaybackOverlay`), qui n'a jamais touché au DOM et sert donc React
 * Native tel quel. Ce fichier n'est qu'un plan de câblage : il dit d'où vient
 * la position, où va le saut, et ce que « la lecture est finie » veut dire ici.
 *
 * Deux points valent d'être sus :
 *
 * - la position passée est celle que l'écran AFFICHE (`handleProgress` a déjà
 *   ajouté `streamOffset`), et `onSeek` est celui qui le retranche — la
 *   coquille parle donc en temps de média, jamais en temps de flux ;
 * - `onEndOfPlayback` n'est PAS la fin du fichier mais la fin du chemin :
 *   quand l'arbitre n'a plus rien à proposer, on quitte l'écran. La fin du
 *   fichier, elle, est une ENTRÉE (`ended`) — c'est ce qui permet à l'écran de
 *   fin d'exister au lieu de renvoyer sèchement à la fiche.
 */
interface Options {
  itemId: string;
  pb: PlayerPlayback;
  /** Position affichée, en secondes (offset de flux déjà appliqué). */
  currentTime: number;
  /** Le flux est arrivé au bout (`onEnd` de react-native-video). */
  ended: boolean;
  hasStarted: boolean;
  /** L'habillage du lecteur est-il à l'écran ? (un passage mis en sourdine par
   *  la croix n'est plus rendu qu'avec lui). */
  controlsVisible: boolean;
  /** Un scrub est en cours : rien ne paraît, les décomptes se suspendent. */
  scrubbing: boolean;
  onSeek: (seconds: number) => void;
  onNextEpisode: () => void;
  onEndOfPlayback: () => void;
}

export function usePlaybackOverlayMobile({
  itemId, pb, currentTime, ended, hasStarted, controlsVisible, scrubbing,
  onSeek, onNextEpisode, onEndOfPlayback,
}: Options): PlaybackOverlayResult {
  // `active` : la config d'auto-play est repollée pendant la lecture, comme
  // sur le web — un interrupteur admin s'applique sans relancer l'app.
  const autoplay = useAutoplayConfig(true);

  return usePlaybackOverlay({
    itemId,
    // Parité web : un « épisode » orphelin de série n'en est pas un pour
    // l'arbitre (mêmes règles de fin qu'un film).
    isEpisode: pb.item?.Type === "Episode" && !!pb.item?.SeriesId,
    hasNextEpisode: !!pb.episodeNav.nextEpisode,
    positionSeconds: currentTime,
    durationSeconds: pb.jellyfinDuration || 0,
    hasStarted,
    controlsVisible,
    scrubbing,
    playbackEnded: ended,
    segments: pb.segments.segments,
    runtimeMs: pb.segments.runtimeMs,
    // Les règles « avant la fin » ciblées par bibliothèque ne s'appliquent
    // qu'avec lui — le contrat résolu le porte déjà, il suffisait de le passer.
    libraryId: pb.segments.libraryId ?? null,
    serverAutoplayEnabled: autoplay.data?.enabled ?? true,
    onSeekSeconds: onSeek,
    onNextEpisode,
    onEndOfPlayback,
  });
}
