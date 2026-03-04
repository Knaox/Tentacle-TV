import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMediaItem, useItemAncestors, useJellyfinClient, useResolveMediaTracks, useEpisodeNavigation, useIntroSkipper, useAppConfig } from "@tentacle-tv/api-client";
import { ticksToSeconds, TICKS_PER_SECOND } from "@tentacle-tv/shared";
import type { MediaStream as JfStream } from "@tentacle-tv/shared";
import type { AudioTrack, SubtitleTrack } from "../components/VideoPlayer";
import { usePlaybackInfo } from "./usePlaybackInfo";

function formatTrackLabel(s: JfStream, t: (key: string, opts?: Record<string, unknown>) => string): string {
  const title = s.DisplayTitle || s.Title || s.Language || t("player:trackFallback", { index: s.Index });
  const codec = s.Codec?.toUpperCase();
  const parts = [title];
  if (codec && !title.toUpperCase().includes(codec)) parts.push(codec);
  return parts.join(" - ");
}

const DBG = "[Tentacle:Player]";

export const BURN_IN_SUBTITLE_CODECS = /^(pgssub|dvdsub|dvbsub|hdmv_pgs_subtitle|pgs)$/i;

export const supportsNativeAudioTracks = (() => {
  if (typeof document === "undefined") return false;
  const v = document.createElement("video");
  return "audioTracks" in v;
})();

const useProgressiveRemux = false;

export interface WatchSessionOptions {
  isDesktop: boolean;
  /** Only used by desktop path. Web uses server-driven PlaybackInfo. */
  checkAudioTranscode?: (codec: string, channels: number) => boolean;
}

export function useWatchSession({ isDesktop, checkAudioTranscode }: WatchSessionOptions) {
  const { t } = useTranslation("player");
  const { itemId } = useParams<{ itemId: string }>();
  const navigate = useNavigate();
  const client = useJellyfinClient();
  const { data: item, isLoading } = useMediaItem(itemId);
  const { data: appConfig } = useAppConfig();
  const { data: ancestors } = useItemAncestors(itemId);
  const { nextEpisode, previousEpisode } = useEpisodeNavigation(item);

  console.debug(DBG, "render", { itemId, isLoading, hasItem: !!item, itemName: item?.Name });

  const mediaSource = item?.MediaSources?.[0];
  const mediaSourceId = mediaSource?.Id ?? itemId;
  const streams: JfStream[] = mediaSource?.MediaStreams ?? [];
  const defaultAudio = streams.find((s) => s.Type === "Audio" && s.IsDefault)?.Index
    ?? streams.find((s) => s.Type === "Audio")?.Index ?? 0;

  const [audioIndex, setAudioIndex] = useState<number>(defaultAudio);
  const [subtitleIndex, setSubtitleIndex] = useState<number | null>(null);
  const [quality, setQuality] = useState<number | null>(null);
  const [startTicks, setStartTicks] = useState<number>(0);
  const [prefsReady, setPrefsReady] = useState(false);
  const [burnInSubtitleIndex, setBurnInSubtitleIndex] = useState<number | undefined>(undefined);
  const positionRef = useRef(0);
  const prefsApplied = useRef(false);
  const audioOverrideRef = useRef(false);
  const resumeApplied = useRef(false);

  // Web: server-driven stream selection via PlaybackInfo
  const pbInfo = usePlaybackInfo();

  useEffect(() => {
    console.debug(DBG, "episode switch — resetting state", { itemId });
    setStartTicks(0); setQuality(null); setSubtitleIndex(null); setPrefsReady(false);
    setBurnInSubtitleIndex(undefined); positionRef.current = 0;
    prefsApplied.current = false; audioOverrideRef.current = false; resumeApplied.current = false;
    if (!isDesktop) pbInfo.reset();
  }, [itemId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (streams.length > 0 && !audioOverrideRef.current && !prefsApplied.current) {
      const defAudio = streams.find((s) => s.Type === "Audio" && s.IsDefault)?.Index
        ?? streams.find((s) => s.Type === "Audio")?.Index ?? 0;
      setAudioIndex(defAudio);
    }
  }, [streams]);

  useEffect(() => {
    if (streams.length > 0 && !prefsApplied.current) {
      const defSub = streams.find((s) => s.Type === "Subtitle" && s.IsDefault)?.Index ?? null;
      if (defSub != null) setSubtitleIndex(defSub);
    }
  }, [streams]);

  // Desktop: client-side playback mode computation
  const selectedAudioStream = streams.find((s) => s.Type === "Audio" && s.Index === audioIndex);
  const selectedAudioCodec = selectedAudioStream?.Codec?.toLowerCase();
  const selectedAudioChannels = selectedAudioStream?.Channels ?? 2;
  const needsAudioTranscode = isDesktop ? false
    : (!!selectedAudioCodec && !!checkAudioTranscode && checkAudioTranscode(selectedAudioCodec, selectedAudioChannels));

  const desktopIsDirectPlay = isDesktop
    ? quality == null
    : (quality == null && !needsAudioTranscode
       && (audioIndex === defaultAudio || supportsNativeAudioTracks));

  console.debug(DBG, "playback mode", { isDesktop, audioIndex, defaultAudio, quality });

  // Desktop: resume position for transcoded streams
  useEffect(() => {
    if (!isDesktop) return;
    if (resumeApplied.current || desktopIsDirectPlay || startTicks > 0 || positionRef.current > 0) return;
    const resumeTicks = item?.UserData?.PlaybackPositionTicks;
    if (resumeTicks && resumeTicks > 0) { resumeApplied.current = true; setStartTicks(resumeTicks); }
  }, [isDesktop, desktopIsDirectPlay, item, startTicks]);

  const skipSegments = useIntroSkipper(itemId, item);

  const getPositionTicks = useCallback((): number => {
    if (positionRef.current > 0) return Math.floor(positionRef.current * TICKS_PER_SECOND);
    const resumeTicks = item?.UserData?.PlaybackPositionTicks;
    return resumeTicks && resumeTicks > 0 ? resumeTicks : 0;
  }, [item]);

  // Desktop: client-generated playSessionId (stable per episode)
  const desktopPlaySessionId = useMemo(() => {
    if (!isDesktop) return "";
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }, [itemId, isDesktop]); // eslint-disable-line react-hooks/exhaustive-deps

  const desktopIsDirectStream = isDesktop && !desktopIsDirectPlay && needsAudioTranscode && quality == null;

  // Preference resolution
  const resolveTracks = useResolveMediaTracks();
  useEffect(() => {
    if (prefsApplied.current || streams.length === 0 || !item) return;
    if ((item.Type === "Episode" || item.Type === "Season") && ancestors === undefined) return;
    const parentId = item.ParentId;
    const seriesId = item.SeriesId;
    const ancestorIds = (ancestors ?? []).map((a) => a.Id);
    const allCandidates = [...new Set([parentId, seriesId, ...ancestorIds].filter(Boolean))] as string[];
    if (allCandidates.length === 0) { setPrefsReady(true); return; }
    prefsApplied.current = true;
    const aTracks = streams.filter((s) => s.Type === "Audio")
      .map((s) => ({ index: s.Index, language: s.Language, isDefault: s.IsDefault, title: [s.Title, s.DisplayTitle].filter(Boolean).join(" ") }));
    const sTracks = streams.filter((s) => s.Type === "Subtitle")
      .map((s) => ({ index: s.Index, language: s.Language, isForced: s.IsForced, title: [s.Title, s.DisplayTitle].filter(Boolean).join(" ") }));
    resolveTracks.mutate({ libraryId: allCandidates[0], libraryIds: allCandidates, audioTracks: aTracks, subtitleTracks: sTracks }, {
      onSuccess: (result) => {
        if (result.audioIndex != null) {
          if (isDesktop) {
            // Desktop: check if new audio changes direct play status
            const newStream = streams.find((s) => s.Type === "Audio" && s.Index === result.audioIndex);
            const codec = newStream?.Codec?.toLowerCase() ?? "";
            const channels = newStream?.Channels ?? 2;
            const needsXcode = checkAudioTranscode ? checkAudioTranscode(codec, channels) : false;
            const willBeDP = quality == null && !needsXcode
              && (result.audioIndex === defaultAudio || supportsNativeAudioTracks);
            if (!willBeDP) {
              const resumeTicks = item?.UserData?.PlaybackPositionTicks;
              if (resumeTicks && resumeTicks > 0) { setStartTicks(resumeTicks); resumeApplied.current = true; }
            }
          }
          // Web: server determines direct play via PlaybackInfo — no client check needed
          setAudioIndex(result.audioIndex);
        }
        if (result.subtitleIndex != null) {
          const idx = result.subtitleIndex === -1 ? null : result.subtitleIndex;
          setSubtitleIndex(idx);
          if (idx != null) {
            const sub = streams.find((s) => s.Type === "Subtitle" && s.Index === idx);
            if (sub && BURN_IN_SUBTITLE_CODECS.test(sub.Codec ?? "")) setBurnInSubtitleIndex(idx);
          }
        }
        setPrefsReady(true);
      },
      onError: () => setPrefsReady(true),
    });
  }, [streams, item, ancestors]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (prefsReady || streams.length === 0) return;
    const timer = setTimeout(() => setPrefsReady(true), 2000);
    return () => clearTimeout(timer);
  }, [prefsReady, streams.length]);

  // ── Web: fetch PlaybackInfo when params change ──
  useEffect(() => {
    if (isDesktop || !prefsReady || !itemId) return;
    const resumeTicks = item?.UserData?.PlaybackPositionTicks ?? 0;
    const ticks = startTicks > 0 ? startTicks : resumeTicks;
    pbInfo.fetchPlaybackInfo({
      itemId,
      mediaSourceId,
      audioStreamIndex: audioIndex,
      subtitleStreamIndex: burnInSubtitleIndex,
      startTimeTicks: ticks > 0 ? ticks : undefined,
      maxStreamingBitrate: quality ?? 42_000_000,
    });
  }, [isDesktop, prefsReady, itemId, mediaSourceId, audioIndex, burnInSubtitleIndex, startTicks, quality]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Desktop: client-side stream URL ──
  const qualityMaxHeight = quality != null
    ? (quality <= 4_000_000 ? 480 : quality <= 8_000_000 ? 720 : quality <= 20_000_000 ? 1080 : undefined) : undefined;
  const urlAudioIndex = desktopIsDirectPlay ? undefined : audioIndex;

  const desktopStreamUrl = useMemo(() => {
    if (!isDesktop || !itemId || !prefsReady) return null;
    return client.getStreamUrl(itemId, {
      audioIndex: urlAudioIndex, mediaSourceId, maxBitrate: quality ?? undefined,
      maxHeight: qualityMaxHeight, directPlay: desktopIsDirectPlay,
      startTimeTicks: !desktopIsDirectPlay && startTicks > 0 ? startTicks : undefined,
      playSessionId: desktopPlaySessionId, useProgressiveRemux,
      subtitleStreamIndex: burnInSubtitleIndex,
    });
  }, [client, itemId, urlAudioIndex, mediaSourceId, quality, qualityMaxHeight, desktopIsDirectPlay, startTicks, desktopPlaySessionId, prefsReady, burnInSubtitleIndex, isDesktop]);

  // ── Unified return values ──
  const isDirectPlay = isDesktop ? desktopIsDirectPlay : pbInfo.isDirectPlay;
  const isDirectStream = isDesktop ? desktopIsDirectStream : pbInfo.isDirectStream;
  const playSessionId = isDesktop ? desktopPlaySessionId : (pbInfo.playSessionId ?? "");
  const streamUrl = isDesktop ? desktopStreamUrl : pbInfo.streamUrl;
  const streamOffset = isDesktop
    ? (!desktopIsDirectPlay && startTicks > 0 ? startTicks / TICKS_PER_SECOND : 0)
    : pbInfo.streamOffset;

  const audioTracks: AudioTrack[] = useMemo(() =>
    streams.filter((s) => s.Type === "Audio")
      .map((s) => ({ index: s.Index, label: formatTrackLabel(s, t), lang: s.Language?.toLowerCase() })),
    [streams, t]);

  const subtitleTracks: SubtitleTrack[] = useMemo(() =>
    streams.filter((s) => s.Type === "Subtitle")
      .map((s) => ({ index: s.Index, label: formatTrackLabel(s, t), url: client.getSubtitleUrl(itemId!, mediaSourceId!, s.Index), lang: s.Language?.toLowerCase(), codec: s.Codec?.toLowerCase() })),
    [streams, client, itemId, mediaSourceId, t]);

  const jellyfinDuration = useMemo(() => ticksToSeconds(item?.RunTimeTicks), [item]);
  const posterUrl = useMemo(() => itemId ? client.getImageUrl(itemId, "Backdrop", { quality: 80 }) : undefined, [client, itemId]);
  const startPositionSeconds = useMemo(() => {
    const ticks = item?.UserData?.PlaybackPositionTicks;
    return ticks ? ticks / TICKS_PER_SECOND : undefined;
  }, [item]);

  const handleNextEpisode = useCallback(() => {
    if (nextEpisode) navigate(`/watch/${nextEpisode.Id}`, { replace: true });
  }, [nextEpisode, navigate]);
  const handlePreviousEpisode = useCallback(() => {
    if (previousEpisode) navigate(`/watch/${previousEpisode.Id}`, { replace: true });
  }, [previousEpisode, navigate]);

  const autoplayCreditsSeconds = (appConfig?.autoplayCreditsMinutes ?? 2) * 60;

  return {
    itemId, item, isLoading, client, streams, mediaSourceId, defaultAudio,
    audioIndex, setAudioIndex, subtitleIndex, setSubtitleIndex,
    quality, setQuality, startTicks, setStartTicks,
    burnInSubtitleIndex, setBurnInSubtitleIndex,
    positionRef, audioOverrideRef,
    needsAudioTranscode, isDirectPlay, isDirectStream, playSessionId,
    streamUrl, streamOffset,
    audioTracks, subtitleTracks,
    jellyfinDuration, startPositionSeconds, posterUrl,
    nextEpisode, previousEpisode, handleNextEpisode, handlePreviousEpisode,
    skipSegments, autoplayCreditsSeconds, getPositionTicks,
  };
}
