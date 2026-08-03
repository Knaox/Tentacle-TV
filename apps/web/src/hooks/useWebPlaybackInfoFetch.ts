import { useEffect } from "react";
import type { MediaItem } from "@tentacle-tv/shared";
import type { usePlaybackInfo } from "./usePlaybackInfo";

interface Options {
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
}: Options): void {
  useEffect(() => {
    if (isDesktop || !prefsReady || !itemId) return;
    const resumeTicks = item?.UserData?.PlaybackPositionTicks ?? 0;
    const ticks = startTicks > 0 ? startTicks : resumeTicks;
    // Edge/Chrome: no native audioTracks API — if user wants non-default audio,
    // force server-side audio selection (remux/transcode) instead of direct play.
    const forceTranscode = !supportsNativeAudioTracks && audioIndex !== defaultAudio;
    pbInfo.fetchPlaybackInfo({
      itemId,
      mediaSourceId,
      audioStreamIndex: audioIndex,
      subtitleStreamIndex: burnInSubtitleIndex,
      startTimeTicks: ticks > 0 ? ticks : undefined,
      maxStreamingBitrate: quality ?? 42_000_000,
      forceTranscode,
    });
  }, [isDesktop, prefsReady, itemId, mediaSourceId, audioIndex, burnInSubtitleIndex, startTicks, quality]); // eslint-disable-line react-hooks/exhaustive-deps
}
