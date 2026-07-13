import { useEffect } from "react";
import { Platform } from "react-native";
import type { MediaStream as JfStream, SubtitleCue } from "@tentacle-tv/shared";
import type { MPVPlayerHandle } from "../components/player/MPVPlayer";
import type { ExoTextTrack } from "../components/player/ExoPlayer";
import { useTVTextTracks } from "./useTVTextTracks";
import { useTVSubtitles } from "./useTVSubtitles";

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
  isLocalRemux: boolean;
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
    itemId, mediaSourceId, streams, useExoPlayer, subtitleIndex, isLocalRemux,
    exoRef, subtitleTrackMap, displayTimeRef, bufferedTimeRef, lastProgressTime, lastDisplayUpdate,
    pausedStateRef, overlayVisible, setDisplayTime, setBufferedTime,
  } = args;

  // Pistes texte VTT chargées NATIVEMENT : Android ExoPlayer (direct play) +
  // tvOS AVPlayer (sideload, direct play ET transcode). La sélection est
  // déclarative sur tvOS (prop subtitleIndex → AVPlayerSurface), impérative sur
  // Android (effet ci-dessous). Burn-in PGS exclu (géré par le serveur).
  const textTracks = useTVTextTracks({
    itemId, mediaSourceId, streams,
    enabled: useExoPlayer || Platform.OS === "ios",
  });

  // Sélection sous-titre native ExoPlayer (Android) sans re-prepare. Sur tvOS,
  // la sélection est déclarative (subtitleIndex passé à la surface) → on saute.
  useEffect(() => {
    if (!useExoPlayer || Platform.OS === "ios") return;
    if (subtitleIndex < 0) { exoRef.current?.setSubtitleTrack(0); return; }
    const nativeId = subtitleTrackMap[subtitleIndex];
    if (nativeId != null) exoRef.current?.setSubtitleTrack(nativeId);
  }, [useExoPlayer, subtitleIndex, subtitleTrackMap]); // eslint-disable-line react-hooks/exhaustive-deps

  // Overlay JS = Android MPV/transcode + remux local tvOS (manifeste HLS SANS piste texte).
  // -1 (rendu NATIF, pas d'overlay) dans les autres cas :
  //  - Android ExoPlayer (direct play) → VTT natif (subtitleView) ;
  //  - tvOS hors remux → sideload VTT (direct play) / pistes du manifeste HLS (transcode).
  // ⚠️ `useExoPlayer` ne doit gater QUE sur Android : sur tvOS il vaut true hors transcode
  // (ExoPlayer.ios ET MPVPlayer.ios pointent tous deux AVPlayerSurface) → l'inclure tel quel
  // masquait l'overlay du remux (passait -1 alors qu'isLocalRemux voulait l'overlay JS).
  const subtitleCue = useTVSubtitles({
    itemId, mediaSourceId,
    subtitleIndex: ((Platform.OS !== "ios" && useExoPlayer) || (Platform.OS === "ios" && !isLocalRemux))
      ? -1 : subtitleIndex,
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
