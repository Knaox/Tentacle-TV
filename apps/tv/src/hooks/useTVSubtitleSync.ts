import { useEffect } from "react";
import type { MediaStream as JfStream, SubtitleCue } from "@tentacle-tv/shared";
import type { ExoTextTrack } from "../components/player/ExoPlayer";
import { useTVSubtitles } from "./useTVSubtitles";

/**
 * Aucune piste texte chargée NATIVEMENT dans ExoPlayer : tout le texte passe
 * par le calque JS (`SubtitleLayer`), sur les deux téléviseurs — même style,
 * et il remonte avec l'habillage. ExoPlayer garde la prop `textTracks`
 * (moteur), vide ici.
 */
const NO_NATIVE_TEXT: ExoTextTrack[] = [];

/**
 * Sous-titres du lecteur TV : le calque JS (useTVSubtitles) et la synchro
 * d'affichage de la barre à la réapparition de l'OSD.
 *
 * NB : les deux hooks de sous-titres consomment `mediaSource?.Id` (et non la
 * variable `mediaSourceId = mediaSource?.Id ?? itemId`) → passé tel quel via
 * `mediaSourceId` (peut être undefined).
 */
export function useTVSubtitleSync(args: {
  itemId: string;
  /** = mediaSource?.Id (peut être undefined), PAS le fallback `?? itemId`. */
  mediaSourceId?: string;
  streams: JfStream[];
  subtitleIndex: number;
  displayTimeRef: React.MutableRefObject<number>;
  bufferedTimeRef: React.MutableRefObject<number>;
  lastProgressTime: React.MutableRefObject<number>;
  lastDisplayUpdate: React.MutableRefObject<number>;
  pausedStateRef: React.MutableRefObject<boolean>;
  overlayVisible: boolean;
  setDisplayTime: (v: number) => void;
  setBufferedTime: (v: number) => void;
}): { subtitleCue: SubtitleCue | null; textTracks: ExoTextTrack[] } {
  const {
    itemId, mediaSourceId, streams, subtitleIndex,
    displayTimeRef, bufferedTimeRef, lastProgressTime, lastDisplayUpdate,
    pausedStateRef, overlayVisible, setDisplayTime, setBufferedTime,
  } = args;

  // Overlay JS = TOUT le texte, sur les deux téléviseurs (direct play,
  // PrismCore, transcode ; ExoPlayer comme mpv).
  const subtitleCue = useTVSubtitles({
    itemId, mediaSourceId,
    subtitleIndex,
    streams,
    displayTimeRef, lastProgressTime, pausedStateRef,
  });

  useEffect(() => {
    if (overlayVisible) {
      setDisplayTime(displayTimeRef.current);
      setBufferedTime(bufferedTimeRef.current);
      lastDisplayUpdate.current = Date.now();
    }
  }, [overlayVisible]); // eslint-disable-line react-hooks/exhaustive-deps

  return { subtitleCue, textTracks: NO_NATIVE_TEXT };
}
