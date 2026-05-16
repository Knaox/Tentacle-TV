import { useState, useCallback, useRef, useMemo } from "react";
import { Platform } from "react-native";
import {
  useJellyfinClient, useUserId, useMediaItem, useItemAncestors,
  usePlaybackReporting, useIntroSkipper, useEpisodeNavigation,
} from "@tentacle-tv/api-client";
import { TICKS_PER_SECOND, ticksToSeconds, QUALITY_PRESETS, findPreset } from "@tentacle-tv/shared";
import type { MediaStream as JfStream, MediaSource, QualityKey } from "@tentacle-tv/shared";
import {
  buildStreamUrl, buildTextTracks, detectBurnIn, isBitmapSub,
  buildPlatformDeviceProfile, extractActualStartTicks,
  type TextTrackEntry,
} from "./usePlaybackInfoFetch";

const DBG = "[Tentacle:Playback]";

export { QUALITY_PRESETS };
export type { QualityKey, TextTrackEntry };

export interface PlaybackState {
  streamUrl: string | null;
  playSessionId: string | null;
  mediaSource: MediaSource | null;
  isDirectPlay: boolean;
  isDirectStream: boolean;
  streamOffset: number;
  isLoading: boolean;
  error: string | null;
  textTracks: TextTrackEntry[];
  /** Bitmap subtitle burn-in index (-1 = none) */
  burnInSubIndex: number;
  /** Native start position in ms for react-native-video source.startPosition */
  startPositionMs: number;
  /** Auth headers for react-native-video source */
  headers: Record<string, string>;
}

const INITIAL_STATE: PlaybackState = {
  streamUrl: null, playSessionId: null, mediaSource: null,
  isDirectPlay: false, isDirectStream: false, streamOffset: 0,
  isLoading: true, error: null, textTracks: [], burnInSubIndex: -1,
  startPositionMs: 0, headers: {},
};

export function usePlayerPlayback(itemId: string) {
  const client = useJellyfinClient();
  const userId = useUserId();
  const { data: item } = useMediaItem(itemId);
  const { data: ancestors } = useItemAncestors(itemId);
  const fetchIdRef = useRef(0);

  const [state, setState] = useState<PlaybackState>(INITIAL_STATE);
  const [audioIndex, setAudioIndex] = useState(0);
  const [subtitleIndex, setSubtitleIndex] = useState(-1);
  const [qualityKey, setQualityKey] = useState<QualityKey>("original");
  const positionRef = useRef(0);
  // Refs mirror audioIndex/subtitleIndex for synchronous reads in fetchPlaybackInfo.
  // Fixes race condition when changeAudio + changeSubtitle fire in the same tick.
  const audioIndexRef = useRef(0);
  const subtitleIndexRef = useRef(-1);

  const streams: JfStream[] = useMemo(
    () => item?.MediaSources?.[0]?.MediaStreams ?? [],
    [item],
  );
  const mediaSourceId = item?.MediaSources?.[0]?.Id ?? itemId;
  const jellyfinDuration = useMemo(() => ticksToSeconds(item?.RunTimeTicks), [item]);

  const episodeNav = useEpisodeNavigation(item);
  const skipSegments = useIntroSkipper(itemId, item);

  /** Core fetch: POST PlaybackInfo with platform DeviceProfile */
  const fetchPlaybackInfo = useCallback(async (opts?: {
    audioStreamIndex?: number;
    subtitleStreamIndex?: number;
    startTimeTicks?: number;
    maxBitrate?: number;
    maxWidth?: number;
    maxHeight?: number;
    isRetry?: boolean;
  }) => {
    if (!userId) return;
    const currentFetch = ++fetchIdRef.current;
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    const preset = findPreset(qualityKey);
    const bitrate = opts?.maxBitrate ?? preset.bitrate ?? 0;
    const maxWidth = opts?.maxWidth ?? preset.width ?? 0;
    const maxHeight = opts?.maxHeight ?? preset.height ?? 0;
    const profile = buildPlatformDeviceProfile(bitrate, opts?.isRetry ?? false);

    try {
      const result = await client.getPlaybackInfo(itemId, {
        userId, deviceProfile: profile, mediaSourceId,
        audioStreamIndex: opts?.audioStreamIndex ?? audioIndexRef.current,
        subtitleStreamIndex: opts?.subtitleStreamIndex ?? (subtitleIndexRef.current >= 0 ? subtitleIndexRef.current : undefined),
        startTimeTicks: opts?.startTimeTicks,
        maxStreamingBitrate: bitrate > 0 ? bitrate : undefined,
        maxWidth: maxWidth > 0 ? maxWidth : undefined,
        maxHeight: maxHeight > 0 ? maxHeight : undefined,
      });

      if (fetchIdRef.current !== currentFetch) return;

      const ms = result.MediaSources?.[0];
      if (!ms) { setState((prev) => ({ ...prev, isLoading: false, error: "No media source" })); return; }

      const directPlay = ms.SupportsDirectPlay && !ms.TranscodingUrl;
      const directStream = ms.SupportsDirectStream && !directPlay;
      const subIdx = opts?.subtitleStreamIndex ?? subtitleIndexRef.current;

      const ds = client.getDirectStreaming();
      const url = buildStreamUrl({
        itemId, ms, directPlay, ds: ds ?? null,
        baseUrl: client.getBaseUrl(), accessToken: client.getAccessToken(), subIdx,
      });
      if (!url) { setState((prev) => ({ ...prev, isLoading: false, error: "No stream URL" })); return; }

      const actualOffsetTicks = directPlay ? 0 : extractActualStartTicks(ms);
      const streamOffset = actualOffsetTicks > 0 ? actualOffsetTicks / 10_000_000 : 0;
      const burnIn = detectBurnIn(ms, subIdx);
      // Only sideload VTT for direct play — Jellyfin embeds text subs in HLS manifest.
      const textTracks = directPlay && burnIn < 0
        ? buildTextTracks(ms, client.getSubtitleUrl.bind(client), itemId) : [];

      // Direct play: native startPosition avoids visible jump.
      // Transcode: HLS stream already starts at offset, no native seek needed.
      const startPositionMs = directPlay ? Math.round(positionRef.current * 1000) : 0;
      const token = ds ? ds.jellyfinToken : client.getAccessToken();
      const headers: Record<string, string> = token ? { "X-Emby-Token": token } : {};

      console.log(DBG, "resolved", {
        directPlay, directStream, startPositionMs, subIdx, burnIn,
        container: ms.Container, url: url.slice(0, 200),
      });

      setState({
        streamUrl: url, playSessionId: result.PlaySessionId, mediaSource: ms,
        isDirectPlay: directPlay, isDirectStream: directStream, streamOffset,
        isLoading: false, error: null,
        textTracks, burnInSubIndex: burnIn, startPositionMs, headers,
      });
    } catch (err) {
      if (fetchIdRef.current !== currentFetch) return;
      console.error(DBG, "PlaybackInfo failed", err);
      setState((prev) => ({ ...prev, isLoading: false, error: "Playback error" }));
    }
  }, [client, userId, itemId, mediaSourceId, qualityKey]);

  const reporting = usePlaybackReporting({
    itemId, mediaSourceId,
    isDirectPlay: state.isDirectPlay,
    isDirectStream: state.isDirectStream,
    playSessionId: state.playSessionId ?? undefined,
    audioStreamIndex: audioIndex,
    subtitleStreamIndex: subtitleIndex === -1 ? null : subtitleIndex,
  });

  /** Direct play : update selectedAudioTrack only. Transcode : refetch with new audio. */
  const changeAudio = useCallback((newIndex: number) => {
    audioIndexRef.current = newIndex;
    setAudioIndex(newIndex);
    if (state.isDirectPlay) return;
    const startTicks = Math.floor(positionRef.current * TICKS_PER_SECOND);
    fetchPlaybackInfo({ audioStreamIndex: newIndex, startTimeTicks: startTicks > 0 ? startTicks : undefined });
  }, [fetchPlaybackInfo, state.isDirectPlay]);

  /** Direct play : toggle locally. Transcode : refetch only for bitmap (burn-in) subs. */
  const changeSubtitle = useCallback((newIndex: number) => {
    subtitleIndexRef.current = newIndex;
    setSubtitleIndex(newIndex);
    const sub = streams.find((s) => s.Index === newIndex && s.Type === "Subtitle");
    const needsBurnIn = sub ? isBitmapSub(sub) : false;
    if (needsBurnIn || (newIndex < 0 && state.burnInSubIndex >= 0)) {
      const startTicks = Math.floor(positionRef.current * TICKS_PER_SECOND);
      fetchPlaybackInfo({
        subtitleStreamIndex: newIndex >= 0 ? newIndex : undefined,
        startTimeTicks: startTicks > 0 ? startTicks : undefined,
      });
    }
  }, [fetchPlaybackInfo, streams, state.burnInSubIndex]);

  const changeQuality = useCallback((key: QualityKey) => {
    setQualityKey(key);
    const preset = findPreset(key);
    const startTicks = Math.floor(positionRef.current * TICKS_PER_SECOND);
    fetchPlaybackInfo({
      maxBitrate: preset.bitrate ?? 0,
      maxWidth: preset.width ?? 0,
      maxHeight: preset.height ?? 0,
      startTimeTicks: startTicks > 0 ? startTicks : undefined,
    });
  }, [fetchPlaybackInfo]);

  const retry = useCallback(() => {
    const startTicks = Math.floor(positionRef.current * TICKS_PER_SECOND);
    fetchPlaybackInfo({ isRetry: true, startTimeTicks: startTicks > 0 ? startTicks : undefined });
  }, [fetchPlaybackInfo]);

  /** Index into textTracks for the active subtitle (-1 = none, direct play only). */
  const textTrackSelectedIndex = useMemo(() => {
    if (!state.isDirectPlay || subtitleIndex < 0 || state.burnInSubIndex >= 0) return -1;
    const textSubStreams = streams.filter((s) => s.Type === "Subtitle" && !isBitmapSub(s));
    return textSubStreams.findIndex((s) => s.Index === subtitleIndex);
  }, [subtitleIndex, state.isDirectPlay, state.burnInSubIndex, streams]);

  /** VTT URL for custom overlay (transcode + Android direct play). iOS direct uses native VTT. */
  const subtitleVttUrl = useMemo(() => {
    if (subtitleIndex < 0) return null;
    if (state.isDirectPlay && Platform.OS !== "android") return null;
    const sub = streams.find((s) => s.Index === subtitleIndex && s.Type === "Subtitle");
    if (!sub || isBitmapSub(sub)) return null;
    return client.getSubtitleUrl(itemId, mediaSourceId, subtitleIndex, "vtt");
  }, [subtitleIndex, state.isDirectPlay, streams, client, itemId, mediaSourceId]);

  /** Index into native audio tracks for selectedAudioTrack prop (0-based, audio streams only). */
  const audioTrackSelectedIndex = useMemo(() => {
    const audioStreams = streams.filter((s) => s.Type === "Audio");
    return audioStreams.findIndex((s) => s.Index === audioIndex);
  }, [audioIndex, streams]);

  return {
    item, ancestors, streams, mediaSourceId, jellyfinDuration,
    ...state,
    audioIndex, subtitleIndex, qualityKey, positionRef,
    textTrackSelectedIndex, audioTrackSelectedIndex, subtitleVttUrl,
    episodeNav, skipSegments, reporting,
    fetchPlaybackInfo, changeAudio, changeSubtitle, changeQuality, retry,
  };
}
