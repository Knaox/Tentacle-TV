import { useEffect, type MutableRefObject } from "react";
import type { MediaItem } from "@tentacle-tv/shared";
import type { usePlaybackInfo } from "./usePlaybackInfo";

interface Options {
  /** Préférences de pistes du serveur appliquées (cf. useServerTrackPrefs). */
  prefsApplied: MutableRefObject<boolean>;
  /** L'utilisateur a explicitement choisi une piste audio dans le sélecteur. */
  audioOverrideRef: MutableRefObject<boolean>;
  isDesktop: boolean;
  prefsReady: boolean;
  itemId: string | undefined;
  mediaSourceId: string | undefined;
  audioIndex: number;
  defaultAudio: number;
  burnInSubtitleIndex: number | undefined;
  startTicks: number;
  quality: number | null;
  item: MediaItem | undefined;
  supportsNativeAudioTracks: boolean;
  pbInfo: ReturnType<typeof usePlaybackInfo>;
}

/**
 * Web : fetch PlaybackInfo à chaque changement de paramètres — extraction
 * mécanique de useWatchSession (limite 300 lignes), comportement inchangé.
 */
export function useWebPlaybackInfoFetch({
  isDesktop, prefsReady, itemId, mediaSourceId, audioIndex, defaultAudio,
  burnInSubtitleIndex, startTicks, quality, item, supportsNativeAudioTracks, pbInfo,
  prefsApplied, audioOverrideRef,
}: Options): void {
  useEffect(() => {
    if (isDesktop || !prefsReady || !itemId) return;
    const resumeTicks = item?.UserData?.PlaybackPositionTicks ?? 0;
    const ticks = startTicks > 0 ? startTicks : resumeTicks;
    // Edge/Chrome: no native audioTracks API — if user wants non-default audio,
    // force server-side audio selection (remux/transcode) instead of direct play.
    //
    // Encore faut-il que quelqu'un ait DEMANDÉ cette piste : préférences du
    // serveur appliquées, ou choix explicite dans le sélecteur. Sans cette
    // garde, le premier rendu compare un `audioIndex` resté à sa valeur
    // d'initialisation avec un `defaultAudio` fraîchement résolu par l'arrivée
    // des `MediaStreams`, et sacrifie le DirectPlay du démarrage pour un écart
    // qui n'existe pas — l'effet de réconciliation le comble au rendu suivant.
    const pisteDemandee = prefsApplied.current || audioOverrideRef.current;
    const forceTranscode = pisteDemandee && !supportsNativeAudioTracks && audioIndex !== defaultAudio;
    pbInfo.fetchPlaybackInfo({
      itemId,
      mediaSourceId,
      audioStreamIndex: audioIndex,
      subtitleStreamIndex: burnInSubtitleIndex,
      startTimeTicks: ticks > 0 ? ticks : undefined,
      maxStreamingBitrate: quality ?? 42_000_000,
      forceTranscode,
    });
    // `mkvNonFiable` EST une dépendance de rendu : c'est lui, et lui seul, qui
    // relance la requête après un repli. Passer par `startTicks` ne suffirait
    // pas — l'échec survient à 0 s, où la position ne change pas.
  }, [isDesktop, prefsReady, itemId, mediaSourceId, audioIndex, burnInSubtitleIndex, startTicks, quality, pbInfo.mkvNonFiable]); // eslint-disable-line react-hooks/exhaustive-deps
}
