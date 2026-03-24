import { useState, useCallback, useRef, useMemo } from "react";
import { Platform } from "react-native";
import {
  useJellyfinClient, useUserId, useMediaItem, useItemAncestors,
  usePlaybackReporting, useIntroSkipper, useEpisodeNavigation,
} from "@tentacle-tv/api-client";
import { TICKS_PER_SECOND, ticksToSeconds } from "@tentacle-tv/shared";
import type { MediaStream as JfStream, MediaSource } from "@tentacle-tv/shared";
import { TextTrackType } from "react-native-video";
import { buildIosDeviceProfile } from "../lib/iosDeviceProfile";
import { buildAndroidDeviceProfile } from "../lib/androidDeviceProfile";
import { toISO6391 } from "../lib/playerUtils";

const DBG = "[Tentacle:Playback]";

/** Quality presets — bitrate in bps, maxWidth/maxHeight for real resolution cap */
export const QUALITY_PRESETS = [
  { key: "original", bitrate: 0, maxWidth: 0, maxHeight: 0 },
  { key: "quality1080p", bitrate: 20_000_000, maxWidth: 1920, maxHeight: 1080 },
  { key: "quality720p", bitrate: 8_000_000, maxWidth: 1280, maxHeight: 720 },
  { key: "quality480p", bitrate: 2_000_000, maxWidth: 854, maxHeight: 480 },
] as const;

export type QualityKey = (typeof QUALITY_PRESETS)[number]["key"];

/** Matches react-native-video's TextTracks array element */
export interface TextTrackEntry {
  title: string;
  /** ISO 639-1 code — cast needed as RNVideo uses a branded type */
  language: string;
  type: TextTrackType;
  uri: string;
}

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

/** Bitmap subtitle codecs that need server-side burn-in */
const BITMAP_CODECS = new Set(["pgssub", "dvdsub", "dvbsub", "pgs", "vobsub"]);

/** Check if a subtitle stream is bitmap (needs burn-in) */
function isBitmapSub(stream: JfStream): boolean {
  return BITMAP_CODECS.has(stream.Codec?.toLowerCase() ?? "");
}

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
  // Fixes race condition when changeAudio + changeSubtitle fire in the same tick
  // (e.g. from usePlayerPreferences onSuccess callback).
  const audioIndexRef = useRef(0);
  const subtitleIndexRef = useRef(-1);

  const streams: JfStream[] = useMemo(
    () => item?.MediaSources?.[0]?.MediaStreams ?? [],
    [item],
  );
  const mediaSourceId = item?.MediaSources?.[0]?.Id ?? itemId;

  const jellyfinDuration = useMemo(() => ticksToSeconds(item?.RunTimeTicks), [item]);

  // Episode navigation
  const episodeNav = useEpisodeNavigation(item);
  const skipSegments = useIntroSkipper(itemId, item);

  // Build external text tracks (VTT only on iOS AVPlayer)
  const buildTextTracks = useCallback((ms: MediaSource): TextTrackEntry[] => {
    if (!ms.MediaStreams) return [];
    return ms.MediaStreams
      .filter((s) => s.Type === "Subtitle" && !isBitmapSub(s))
      .map((s) => ({
        title: s.DisplayTitle || s.Title || s.Language || `Sub ${s.Index}`,
        language: toISO6391(s.Language),
        type: TextTrackType.VTT,
        uri: client.getSubtitleUrl(itemId, ms.Id, s.Index, "vtt"),
      }));
  }, [client, itemId]);

  // Detect bitmap subtitle index for server burn-in
  const detectBurnIn = useCallback((ms: MediaSource, subIdx: number): number => {
    if (subIdx < 0) return -1;
    const sub = ms.MediaStreams?.find((s) => s.Index === subIdx && s.Type === "Subtitle");
    if (sub && isBitmapSub(sub)) return subIdx;
    return -1;
  }, []);

  /** Core fetch: POST PlaybackInfo with iOS DeviceProfile */
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

    const preset = QUALITY_PRESETS.find((p) => p.key === qualityKey);
    const bitrate = opts?.maxBitrate ?? preset?.bitrate ?? 0;
    const maxWidth = opts?.maxWidth ?? preset?.maxWidth ?? 0;
    const maxHeight = opts?.maxHeight ?? preset?.maxHeight ?? 0;
    const profile = Platform.OS === "android"
      ? buildAndroidDeviceProfile(bitrate > 0 ? bitrate : undefined)
      : buildIosDeviceProfile(bitrate > 0 ? bitrate : undefined);

    // On retry after error: strip DirectPlay to force server transcoding
    if (opts?.isRetry) {
      profile.DirectPlayProfiles = [];
    }

    try {
      const result = await client.getPlaybackInfo(itemId, {
        userId,
        deviceProfile: profile,
        mediaSourceId,
        audioStreamIndex: opts?.audioStreamIndex ?? audioIndexRef.current,
        subtitleStreamIndex: opts?.subtitleStreamIndex ?? (subtitleIndexRef.current >= 0 ? subtitleIndexRef.current : undefined),
        startTimeTicks: opts?.startTimeTicks,
        maxStreamingBitrate: bitrate > 0 ? bitrate : undefined,
        maxWidth: maxWidth > 0 ? maxWidth : undefined,
        maxHeight: maxHeight > 0 ? maxHeight : undefined,
      });

      if (fetchIdRef.current !== currentFetch) return;

      const ms = result.MediaSources?.[0];
      if (!ms) {
        setState((prev) => ({ ...prev, isLoading: false, error: "No media source" }));
        return;
      }

      const directPlay = ms.SupportsDirectPlay && !ms.TranscodingUrl;
      const directStream = ms.SupportsDirectStream && !directPlay;

      const subIdx = opts?.subtitleStreamIndex ?? subtitleIndexRef.current;

      let url: string;
      const ds = client.getDirectStreaming();
      if (directPlay) {
        const baseUrl = ds ? ds.mediaBaseUrl : client.getBaseUrl();
        const token = ds ? ds.jellyfinToken : client.getAccessToken();
        url = `${baseUrl}/Videos/${itemId}/stream?Static=true&MediaSourceId=${ms.Id}&api_key=${token}`;
      } else if (ms.TranscodingUrl) {
        const baseUrl = ds ? ds.mediaBaseUrl : client.getBaseUrl();
        let transcodingPath = ms.TranscodingUrl;
        if (ds) {
          transcodingPath = transcodingPath.replace(
            /([?&])(api_key|ApiKey)=[^&]*/i,
            `$1ApiKey=${encodeURIComponent(ds.jellyfinToken)}`
          );
        } else if (Platform.OS === "ios") {
          // iOS AirPlay: Apple TV needs api_key in the URL (no cookie support)
          const token = client.getAccessToken();
          if (token && !/api_key|ApiKey/i.test(transcodingPath)) {
            transcodingPath += (transcodingPath.includes("?") ? "&" : "?") + `api_key=${encodeURIComponent(token)}`;
          }
        }
        url = `${baseUrl}${transcodingPath}`;

        // Always force subtitles in HLS manifest for iOS AVPlayer
        // (Jellyfin defaults to false, but iOS needs them embedded in the m3u8)
        url = url.replace(/EnableSubtitlesInManifest=false/i, "EnableSubtitlesInManifest=true");
        if (!/EnableSubtitlesInManifest/i.test(url)) {
          url += (url.includes("?") ? "&" : "?") + "EnableSubtitlesInManifest=true";
        }
        // Ensure SubtitleStreamIndex is present when a subtitle is selected
        if (subIdx >= 0 && !/SubtitleStreamIndex/i.test(url)) {
          url += `&SubtitleStreamIndex=${subIdx}`;
        }
      } else {
        setState((prev) => ({ ...prev, isLoading: false, error: "No stream URL" }));
        return;
      }

      // Parse actual StartTimeTicks from TranscodingUrl (not from requested value)
      // to avoid desync when server ignores or changes the requested offset
      let actualOffsetTicks = 0;
      if (!directPlay && ms.TranscodingUrl) {
        const match = ms.TranscodingUrl.match(/StartTimeTicks=(\d+)/i);
        if (match) actualOffsetTicks = Number(match[1]);
      }
      const streamOffset = actualOffsetTicks > 0 ? actualOffsetTicks / 10_000_000 : 0;
      const burnIn = detectBurnIn(ms, subIdx);
      // Only sideload VTT tracks for direct play — for transcoded HLS,
      // Jellyfin embeds text subs in the manifest (sideloading crashes iOS AVPlayer)
      const textTracks = directPlay && burnIn < 0 ? buildTextTracks(ms) : [];

      // Direct play: use native startPosition to avoid visible jump
      // Transcode: HLS stream already starts at streamOffset, no native seek needed
      const startPositionMs = directPlay
        ? Math.round(positionRef.current * 1000)
        : 0;

      // Build auth headers for react-native-video source (required by some reverse proxies)
      const token = ds ? ds.jellyfinToken : client.getAccessToken();
      const headers: Record<string, string> = token ? { "X-Emby-Token": token } : {};

      console.log(DBG, "resolved", {
        directPlay, directStream, startPositionMs, subIdx, burnIn,
        container: ms.Container,
        hasSubsInManifest: /EnableSubtitlesInManifest=true/i.test(url),
        hasSubIdx: /SubtitleStreamIndex=\d+/i.test(url),
        url: url.slice(0, 200),
      });

      setState({
        streamUrl: url,
        playSessionId: result.PlaySessionId,
        mediaSource: ms,
        isDirectPlay: directPlay,
        isDirectStream: directStream,
        streamOffset,
        isLoading: false,
        error: null,
        textTracks,
        burnInSubIndex: burnIn,
        startPositionMs,
        headers,
      });
    } catch (err) {
      if (fetchIdRef.current !== currentFetch) return;
      console.error(DBG, "PlaybackInfo failed", err);
      setState((prev) => ({ ...prev, isLoading: false, error: "Playback error" }));
    }
  }, [client, userId, itemId, mediaSourceId, qualityKey, buildTextTracks, detectBurnIn]);

  // Playback reporting
  const reporting = usePlaybackReporting({
    itemId,
    mediaSourceId,
    isDirectPlay: state.isDirectPlay,
    isDirectStream: state.isDirectStream,
    playSessionId: state.playSessionId ?? undefined,
    audioStreamIndex: audioIndex,
    subtitleStreamIndex: subtitleIndex === -1 ? null : subtitleIndex,
  });

  /** Change audio track — for direct play, just update selectedAudioTrack (no refetch).
   *  For transcode, refetch to get new HLS with the requested audio. */
  const changeAudio = useCallback((newIndex: number) => {
    audioIndexRef.current = newIndex;
    setAudioIndex(newIndex);
    if (state.isDirectPlay) {
      // Direct play: audio selection handled by selectedAudioTrack prop — no refetch needed
      return;
    }
    const startTicks = Math.floor(positionRef.current * TICKS_PER_SECOND);
    fetchPlaybackInfo({ audioStreamIndex: newIndex, startTimeTicks: startTicks > 0 ? startTicks : undefined });
  }, [fetchPlaybackInfo, state.isDirectPlay]);

  /** Change subtitle track — direct play toggles locally, transcode refetches */
  const changeSubtitle = useCallback((newIndex: number) => {
    subtitleIndexRef.current = newIndex;
    setSubtitleIndex(newIndex);

    if (state.isDirectPlay) {
      // Direct play: text subs are sideloaded VTT — just toggle track index, no refetch
      // Bitmap subs need server burn-in → refetch
      const sub = streams.find((s) => s.Index === newIndex && s.Type === "Subtitle");
      const needsBurnIn = sub ? isBitmapSub(sub) : false;
      if (needsBurnIn || (newIndex < 0 && state.burnInSubIndex >= 0)) {
        const startTicks = Math.floor(positionRef.current * TICKS_PER_SECOND);
        fetchPlaybackInfo({
          subtitleStreamIndex: newIndex >= 0 ? newIndex : undefined,
          startTimeTicks: startTicks > 0 ? startTicks : undefined,
        });
      }
    } else {
      // Transcode: text subs are rendered via custom overlay — no refetch needed.
      // Only refetch for bitmap subs (server burn-in) or when disabling a burn-in sub.
      const sub = streams.find((s) => s.Index === newIndex && s.Type === "Subtitle");
      const needsBurnIn = sub ? isBitmapSub(sub) : false;
      if (needsBurnIn || (newIndex < 0 && state.burnInSubIndex >= 0)) {
        const startTicks = Math.floor(positionRef.current * TICKS_PER_SECOND);
        fetchPlaybackInfo({
          subtitleStreamIndex: newIndex >= 0 ? newIndex : undefined,
          startTimeTicks: startTicks > 0 ? startTicks : undefined,
        });
      }
    }
  }, [fetchPlaybackInfo, streams, state.isDirectPlay, state.burnInSubIndex]);

  /** Change quality preset — refetch with new bitrate + resolution cap */
  const changeQuality = useCallback((key: QualityKey) => {
    setQualityKey(key);
    const preset = QUALITY_PRESETS.find((p) => p.key === key);
    const startTicks = Math.floor(positionRef.current * TICKS_PER_SECOND);
    fetchPlaybackInfo({
      maxBitrate: preset?.bitrate ?? 0,
      maxWidth: preset?.maxWidth ?? 0,
      maxHeight: preset?.maxHeight ?? 0,
      startTimeTicks: startTicks > 0 ? startTicks : undefined,
    });
  }, [fetchPlaybackInfo]);

  /** Retry after error — force transcode */
  const retry = useCallback(() => {
    const startTicks = Math.floor(positionRef.current * TICKS_PER_SECOND);
    fetchPlaybackInfo({ isRetry: true, startTimeTicks: startTicks > 0 ? startTicks : undefined });
  }, [fetchPlaybackInfo]);

  /** Index into textTracks array for the currently selected subtitle (-1 = none).
   *  Only valid for direct play where text tracks are sideloaded as VTT. */
  const textTrackSelectedIndex = useMemo(() => {
    if (!state.isDirectPlay || subtitleIndex < 0 || state.burnInSubIndex >= 0) return -1;
    const textSubStreams = streams.filter((s) => s.Type === "Subtitle" && !isBitmapSub(s));
    return textSubStreams.findIndex((s) => s.Index === subtitleIndex);
  }, [subtitleIndex, state.isDirectPlay, state.burnInSubIndex, streams]);

  /** VTT URL for custom subtitle overlay (transcode mode + Android direct play).
   *  iOS direct play uses native sideloaded VTT tracks via AVPlayer. */
  const subtitleVttUrl = useMemo(() => {
    if (subtitleIndex < 0) return null;
    // iOS direct play: sideloaded VTT handled natively by AVPlayer
    if (state.isDirectPlay && Platform.OS !== "android") return null;
    const sub = streams.find((s) => s.Index === subtitleIndex && s.Type === "Subtitle");
    if (!sub || isBitmapSub(sub)) return null;
    return client.getSubtitleUrl(itemId, mediaSourceId, subtitleIndex, "vtt");
  }, [subtitleIndex, state.isDirectPlay, streams, client, itemId, mediaSourceId]);

  /** Index into native audio tracks for selectedAudioTrack prop (0-based among audio streams only) */
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
