import { useEffect } from "react";
import { Platform } from "react-native";
import type { MediaStream as JfStream, SubtitleCue } from "@tentacle-tv/shared";
import type { MPVPlayerHandle } from "../components/player/MPVPlayer";
import type { ExoTextTrack } from "../components/player/ExoPlayer";
import { useTVTextTracks } from "./useTVTextTracks";
import { useTVSubtitles } from "./useTVSubtitles";
import { REDESIGN_ACTIVE } from "../redesignWiring/redesignGate";

/**
 * Le texte rendu par ExoPlayer lui-même (`SubtitleView`) : l'ancienne UI
 * d'Android TV seulement. La refonte passe TOUT le texte par le calque JS
 * (`SubtitleLayer`), comme l'Apple TV : même style, et il remonte avec
 * l'habillage — le texte natif d'ExoPlayer ne le savait pas. mpv y passait
 * déjà ; les sous-titres image restent incrustés par le serveur.
 */
const EXO_NATIVE_TEXT = Platform.OS !== "ios" && !REDESIGN_ACTIVE;

/**
 * Sous-titres du lecteur Apple TV : pistes texte natives (useTVTextTracks),
 * sélection native ExoPlayer (Android, sans re-prepare), overlay JS
 * (useTVSubtitles) et synchro d'affichage de la barre à la réapparition de
 * l'OSD. Extrait VERBATIM de PlayerScreen — gating de subtitleIndex et
 * commentaires préservés à l'identique.
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
  useExoPlayer: boolean;
  subtitleIndex: number;
  exoRef: React.RefObject<MPVPlayerHandle | null>;
  subtitleTrackMap: Record<number, number>;
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
    itemId, mediaSourceId, streams, useExoPlayer, subtitleIndex,
    exoRef, subtitleTrackMap, displayTimeRef, bufferedTimeRef, lastProgressTime, lastDisplayUpdate,
    pausedStateRef, overlayVisible, setDisplayTime, setBufferedTime,
  } = args;

  // Pistes texte VTT chargées NATIVEMENT : Android ExoPlayer (direct play)
  // UNIQUEMENT — sélection impérative (effet ci-dessous), burn-in PGS exclu
  // (géré par le serveur). Sur tvOS, tout le texte passe par l'overlay JS :
  // le sideload AVPlayer ne marche pas sur HLS et rendait mal le reste.
  const textTracks = useTVTextTracks({
    itemId, mediaSourceId, streams,
    enabled: useExoPlayer && EXO_NATIVE_TEXT,
  });

  // Sélection sous-titre native ExoPlayer (Android) sans re-prepare. Sur tvOS,
  // la sélection est déclarative (subtitleIndex passé à la surface) → on saute.
  useEffect(() => {
    if (!useExoPlayer || !EXO_NATIVE_TEXT) return;
    if (subtitleIndex < 0) { exoRef.current?.setSubtitleTrack(0); return; }
    const nativeId = subtitleTrackMap[subtitleIndex];
    if (nativeId != null) exoRef.current?.setSubtitleTrack(nativeId);
  }, [useExoPlayer, subtitleIndex, subtitleTrackMap]); // eslint-disable-line react-hooks/exhaustive-deps

  // Overlay JS = TOUT le texte tvOS (direct play, PrismCore ET transcode) +
  // Android MPV/transcode, et Android refondu. -1 (pas d'overlay) uniquement
  // sur l'ancienne UI d'Android, ExoPlayer (direct play), où le VTT est rendu
  // nativement (subtitleView).
  // ⚠️ `useExoPlayer` ne doit gater QUE sur Android : sur tvOS il vaut true hors
  // transcode (ExoPlayer.ios ET MPVPlayer.ios pointent tous deux AVPlayerSurface).
  const subtitleCue = useTVSubtitles({
    itemId, mediaSourceId,
    subtitleIndex: (EXO_NATIVE_TEXT && useExoPlayer) ? -1 : subtitleIndex,
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

  return { subtitleCue, textTracks };
}
