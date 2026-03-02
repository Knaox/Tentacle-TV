import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { useMediaItem, useItemAncestors, useJellyfinClient, usePlaybackReporting, useResolveMediaTracks, useEpisodeNavigation, useIntroSkipper } from "@tentacle-tv/api-client";
import { ticksToSeconds, TICKS_PER_SECOND } from "@tentacle-tv/shared";
import type { MediaStream as JfStream } from "@tentacle-tv/shared";
import { VideoPlayer } from "../components/VideoPlayer";
import { DesktopPlayer } from "../components/DesktopPlayer";
import type { AudioTrack, SubtitleTrack } from "../components/VideoPlayer";
import { isTauri } from "../hooks/useDesktopPlayer";
import { PlayerTransition } from "../components/PlayerTransition";

function formatTrackLabel(s: JfStream, t: (key: string, opts?: Record<string, unknown>) => string): string {
  const title = s.DisplayTitle || s.Title || s.Language || t("player:trackFallback", { index: s.Index });
  const codec = s.Codec?.toUpperCase();
  const parts = [title];
  if (codec && !title.toUpperCase().includes(codec)) parts.push(codec);
  return parts.join(" - ");
}

const DBG = "[Tentacle:Player]";

// jellyfin-web pattern: detect native HTML5 audioTracks API support (Firefox, Safari).
// When available, audio switching in Direct Play is instant with no URL rebuild.
// Chrome does NOT support this — falls back to remux with URL rebuild.
const supportsNativeAudioTracks = (() => {
  if (typeof document === "undefined") return false;
  const v = document.createElement("video");
  return "audioTracks" in v;
})();

// Bitmap subtitle codecs that cannot be converted to VTT — require server burn-in.
// jellyfin-web pattern (plugin.js:setCurrentTrackElement): these use DeliveryMethod='Encode'.
const BURN_IN_SUBTITLE_CODECS = /^(pgssub|dvdsub|dvbsub|hdmv_pgs_subtitle|pgs)$/i;

// Safari/iOS need HLS for remux — progressive transcode doesn't support
// HTTP Range requests that WebKit requires for media playback.
const useProgressiveRemux = (() => {
  if (typeof navigator === "undefined") return true;
  const ua = navigator.userAgent;
  // iOS: all browsers use WebKit engine
  if (/iPad|iPhone|iPod/.test(ua)) return false;
  // iPadOS 13+ reports as Macintosh
  if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return false;
  // Safari desktop (exclude Chrome/Chromium which also include "Safari")
  if (/Safari/.test(ua) && !/Chrome/.test(ua) && !/Chromium/.test(ua)) return false;
  return true;
})();

export function Watch() {
  const { t } = useTranslation("player");
  const { itemId } = useParams<{ itemId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const client = useJellyfinClient();
  const { data: item, isLoading } = useMediaItem(itemId);
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
  // jellyfin-web pattern: defer URL construction until preferences are resolved
  // to avoid double-load (default audio → preferred audio URL rebuild).
  const [prefsReady, setPrefsReady] = useState(false);
  // jellyfin-web pattern: bitmap subtitles (PGS) need server burn-in via URL param.
  const [burnInSubtitleIndex, setBurnInSubtitleIndex] = useState<number | undefined>(undefined);
  const positionRef = useRef(0);
  const prefsApplied = useRef(false);
  const audioOverrideRef = useRef(false);
  const resumeApplied = useRef(false);

  // Reset state when switching episodes
  useEffect(() => {
    console.debug(DBG, "episode switch — resetting state", { itemId });
    setStartTicks(0);
    setQuality(null);
    setSubtitleIndex(null);
    setPrefsReady(false);
    setBurnInSubtitleIndex(undefined);
    positionRef.current = 0;
    prefsApplied.current = false;
    audioOverrideRef.current = false;
    resumeApplied.current = false;
  }, [itemId]);

  // Sync audioIndex when streams change (new episode loaded)
  // Skip if user explicitly changed audio OR if preferences have already been applied.
  // Without the prefsApplied guard, a re-render could overwrite the resolved preference.
  useEffect(() => {
    if (streams.length > 0 && !audioOverrideRef.current && !prefsApplied.current) {
      const defAudio = streams.find((s) => s.Type === "Audio" && s.IsDefault)?.Index
        ?? streams.find((s) => s.Type === "Audio")?.Index ?? 0;
      setAudioIndex(defAudio);
    }
  }, [streams]);

  // Sync subtitleIndex from Jellyfin's default subtitle track when streams load.
  // This ensures subtitles are shown immediately (before async preference resolution).
  // The preference effect below will override this with the user's preferred track.
  useEffect(() => {
    if (streams.length > 0 && !prefsApplied.current) {
      const defSub = streams.find((s) => s.Type === "Subtitle" && s.IsDefault)?.Index ?? null;
      if (defSub != null) {
        console.debug(DBG, "init subtitle from Jellyfin default", { defSub });
        setSubtitleIndex(defSub);
      }
    }
  }, [streams]);

  const selectedAudioStream = streams.find(
    (s) => s.Type === "Audio" && s.Index === audioIndex
  );
  const selectedAudioCodec = selectedAudioStream?.Codec?.toLowerCase();
  const selectedAudioChannels = selectedAudioStream?.Channels ?? 2;
  // Force transcode for unsupported codecs OR high channel counts (7.1+ crashes browsers)
  const needsAudioTranscode = !!selectedAudioCodec && (
    /^(ac3|eac3|dts|truehd)$/i.test(selectedAudioCodec) || selectedAudioChannels > 6
  );
  const isDesktop = isTauri();
  // Desktop (mpv): direct play unless user explicitly requests quality transcode.
  // Web: direct play when audio codec is browser-compatible and no quality override.
  // jellyfin-web pattern (playbackmanager.js:setAudioStreamIndex): in Direct Play,
  // audio tracks are switched natively via HTML5 audioTracks API (Firefox/Safari).
  // Chrome falls back to remux (non-default audio forces URL rebuild).
  const isDirectPlay = isDesktop
    ? quality == null
    : (quality == null && !needsAudioTranscode
       && (audioIndex === defaultAudio || supportsNativeAudioTracks));

  console.debug(DBG, "playback mode", {
    isDirectPlay, audioIndex, defaultAudio, selectedAudioCodec, needsAudioTranscode,
    quality, streamCount: streams.length,
  });

  // When starting in transcode mode (e.g. default audio is DTS/TrueHD) with
  // a resume position, initialize startTicks so HLS URL includes StartTimeTicks.
  // Only on first load per episode — not on subsequent audio/quality changes.
  // Guard: never overwrite startTicks if the player is already playing (positionRef > 0).
  useEffect(() => {
    if (resumeApplied.current || isDirectPlay || startTicks > 0) return;
    if (positionRef.current > 0) return;
    const resumeTicks = item?.UserData?.PlaybackPositionTicks;
    if (resumeTicks && resumeTicks > 0) {
      console.debug(DBG, "init startTicks from resume (transcode mode)", { resumeTicks });
      resumeApplied.current = true;
      setStartTicks(resumeTicks);
    }
  }, [isDirectPlay, item, startTicks]);

  const skipSegments = useIntroSkipper(itemId, item);

  // Best-effort position in ticks: prefer live positionRef, fallback to resume data
  const getPositionTicks = useCallback((): number => {
    if (positionRef.current > 0) return Math.floor(positionRef.current * TICKS_PER_SECOND);
    const resumeTicks = item?.UserData?.PlaybackPositionTicks;
    return resumeTicks && resumeTicks > 0 ? resumeTicks : 0;
  }, [item]);

  // Unique ID per transcode session — lets Jellyfin's segment handler find
  // the correct transcode started by master.m3u8 (not needed for direct play).
  const playSessionId = useMemo(() => {
    if (isDirectPlay) return undefined;
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }, [audioIndex, quality, startTicks, isDirectPlay]); // eslint-disable-line react-hooks/exhaustive-deps

  // Remux = video copied, only audio transcoded (no explicit quality/bitrate limit)
  const isDirectStream = !isDirectPlay && needsAudioTranscode && quality == null;

  // Playback reporting — now sends PlaySessionId, audio/subtitle indices to Jellyfin
  const { reportStart, reportStop, updatePosition, reportSeek } = usePlaybackReporting({
    itemId, mediaSourceId, isDirectPlay, isDirectStream,
    playSessionId,
    audioStreamIndex: audioIndex,
    subtitleStreamIndex: subtitleIndex,
  });

  // Invalidate all relevant caches on leave so Home + MediaDetail show fresh data.
  // Explicit reportStop ensures Jellyfin records the final position before we refetch.
  const reportStopRef = useRef(reportStop);
  reportStopRef.current = reportStop;
  useEffect(() => {
    return () => {
      reportStopRef.current();
      const id = itemId;
      const keys = [
        { queryKey: ["item", id] },
        { queryKey: ["resume-items"] },
        { queryKey: ["next-up"] },
        { queryKey: ["watched-items"] },
      ];
      // Invalidate only — React Query will refetch in the background when
      // the consuming components remount (no visible "mega refresh").
      keys.forEach((k) => queryClient.invalidateQueries(k));
    };
  }, [itemId, queryClient]);

  // Resolve preferred tracks — uses ParentId/SeriesId + ancestors (if available) to find the library.
  // Does NOT block on ancestors — ParentId alone is usually sufficient for movies.
  const resolveTracks = useResolveMediaTracks();
  useEffect(() => {
    if (prefsApplied.current || streams.length === 0 || !item) return;
    // For episodes/seasons, ancestors are required to resolve the library root ID.
    // ParentId = season, SeriesId = series — neither is the library where preferences are stored.
    if ((item.Type === "Episode" || item.Type === "Season") && ancestors === undefined) return;
    const parentId = item.ParentId;
    const seriesId = item.SeriesId;
    const ancestorIds = (ancestors ?? []).map((a) => a.Id);
    const allCandidates = [...new Set([parentId, seriesId, ...ancestorIds].filter(Boolean))] as string[];
    // No library candidates — no preferences to resolve, ready to play immediately.
    if (allCandidates.length === 0) { setPrefsReady(true); return; }
    prefsApplied.current = true;
    const audioTracksPayload = streams.filter((s) => s.Type === "Audio")
      .map((s) => ({ index: s.Index, language: s.Language, isDefault: s.IsDefault, title: [s.Title, s.DisplayTitle].filter(Boolean).join(" ") }));
    const subtitleTracksPayload = streams.filter((s) => s.Type === "Subtitle")
      .map((s) => ({ index: s.Index, language: s.Language, isForced: s.IsForced, title: [s.Title, s.DisplayTitle].filter(Boolean).join(" ") }));
    console.debug(DBG, "resolve tracks", { parentId, seriesId, allCandidates,
      itemType: item.Type,
      ancestorsLoaded: ancestors !== undefined,
      ancestorTypes: (ancestors ?? []).map((a) => ({ id: a.Id, name: a.Name, type: a.Type })),
      audioTracks: audioTracksPayload.map((t) => ({ idx: t.index, lang: t.language, title: t.title })),
      subtitleTracks: subtitleTracksPayload.map((t) => ({ idx: t.index, lang: t.language, title: t.title, forced: t.isForced })),
    });
    resolveTracks.mutate({
      libraryId: allCandidates[0],
      libraryIds: allCandidates,
      audioTracks: audioTracksPayload,
      subtitleTracks: subtitleTracksPayload,
    }, {
      onSuccess: (result) => {
        console.debug(DBG, "preferences resolved", { audio: result.audioIndex, subtitle: result.subtitleIndex, currentPosition: positionRef.current });
        if (result.audioIndex != null) {
          // jellyfin-web pattern: predict if preferred audio needs transcoding.
          // If so, include resume position in startTicks for HLS URL.
          const newStream = streams.find((s) => s.Type === "Audio" && s.Index === result.audioIndex);
          const codec = newStream?.Codec?.toLowerCase() ?? "";
          const channels = newStream?.Channels ?? 2;
          const needsTranscode = /^(ac3|eac3|dts|truehd)$/i.test(codec) || channels > 6;
          const willBeDirectPlay = isDesktop
            ? quality == null
            : (quality == null && !needsTranscode
               && (result.audioIndex === defaultAudio || supportsNativeAudioTracks));
          if (!willBeDirectPlay) {
            const resumeTicks = item?.UserData?.PlaybackPositionTicks;
            if (resumeTicks && resumeTicks > 0) {
              setStartTicks(resumeTicks);
              resumeApplied.current = true;
            }
          }
          setAudioIndex(result.audioIndex);
        }
        // -1 = explicitly disabled, positive = specific track, null = no preference
        if (result.subtitleIndex != null) {
          const idx = result.subtitleIndex === -1 ? null : result.subtitleIndex;
          setSubtitleIndex(idx);
          // jellyfin-web pattern: bitmap subtitles (PGS) need server burn-in.
          if (idx != null) {
            const subStream = streams.find((s) => s.Type === "Subtitle" && s.Index === idx);
            if (subStream && BURN_IN_SUBTITLE_CODECS.test(subStream.Codec ?? "")) {
              setBurnInSubtitleIndex(idx);
            }
          }
        }
        setPrefsReady(true);
      },
      onError: () => {
        // Preferences failed — play with defaults.
        console.debug(DBG, "preferences resolve failed — using defaults");
        setPrefsReady(true);
      },
    });
  }, [streams, item, ancestors]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fallback: don't wait forever for preferences — start playback after 2s.
  useEffect(() => {
    if (prefsReady || streams.length === 0) return;
    const timer = setTimeout(() => {
      console.debug(DBG, "prefs timeout — starting playback with defaults");
      setPrefsReady(true);
    }, 2000);
    return () => clearTimeout(timer);
  }, [prefsReady, streams.length]);

  // Source video codec — needed for remux mode so Jellyfin does stream copy
  const sourceVideoCodec = streams.find((s) => s.Type === "Video")?.Codec?.toLowerCase();

  // Map quality bitrate to max video height for Jellyfin resolution scaling
  const qualityMaxHeight = quality != null
    ? (quality <= 4_000_000 ? 480 : quality <= 8_000_000 ? 720 : quality <= 20_000_000 ? 1080 : undefined)
    : undefined;

  // jellyfin-web pattern: in Direct Play, audio tracks are switched natively
  // (HTML5 audioTracks on web, mpv set_property on desktop) — exclude from URL
  // to prevent unnecessary stream reload. Only include for transcoding/remux.
  const urlAudioIndex = isDirectPlay ? undefined : audioIndex;

  // Text subtitles are handled externally via <track> elements — NOT in the stream URL.
  // Bitmap subtitles (PGS) use server burn-in via SubtitleStreamIndex in the URL.
  // jellyfin-web pattern (playbackmanager.js:changeStream): gate URL on prefsReady
  // to avoid double-load when preferences resolve to a different audio/subtitle track.
  const streamUrl = useMemo(() => {
    if (!itemId || !prefsReady) return null;
    const url = client.getStreamUrl(itemId, {
      audioIndex: urlAudioIndex,
      mediaSourceId,
      maxBitrate: quality ?? undefined,
      maxHeight: qualityMaxHeight,
      directPlay: isDirectPlay,
      startTimeTicks: !isDirectPlay && startTicks > 0 ? startTicks : undefined,
      playSessionId,
      sourceVideoCodec,
      useProgressiveRemux,
      subtitleStreamIndex: burnInSubtitleIndex,
    });
    console.debug(DBG, "stream URL built", { url: url?.substring(0, 120) + "...", isDirectPlay, startTicks, quality, qualityMaxHeight, burnInSubtitleIndex });
    return url;
  }, [client, itemId, urlAudioIndex, mediaSourceId, quality, qualityMaxHeight, isDirectPlay, startTicks, playSessionId, sourceVideoCodec, prefsReady, burnInSubtitleIndex]);

  // Stream offset in seconds (for transcoded seeking)
  const streamOffset = !isDirectPlay && startTicks > 0 ? startTicks / TICKS_PER_SECOND : 0;

  const audioTracks: AudioTrack[] = useMemo(() =>
    streams.filter((s) => s.Type === "Audio")
      .map((s) => ({ index: s.Index, label: formatTrackLabel(s, t), lang: s.Language?.toLowerCase() })),
    [streams, t]
  );

  const subtitleTracks: SubtitleTrack[] = useMemo(() =>
    streams.filter((s) => s.Type === "Subtitle")
      .map((s) => ({ index: s.Index, label: formatTrackLabel(s, t), url: client.getSubtitleUrl(itemId!, mediaSourceId!, s.Index), lang: s.Language?.toLowerCase(), codec: s.Codec?.toLowerCase() })),
    [streams, client, itemId, mediaSourceId, t]
  );

  const jellyfinDuration = useMemo(() => ticksToSeconds(item?.RunTimeTicks), [item]);
  const posterUrl = useMemo(() => {
    if (!itemId) return undefined;
    return client.getImageUrl(itemId, "Backdrop", { quality: 80 });
  }, [client, itemId]);
  // BUG 5: resume position from Jellyfin UserData
  const startPositionSeconds = useMemo(() => {
    const ticks = item?.UserData?.PlaybackPositionTicks;
    return ticks ? ticks / TICKS_PER_SECOND : undefined;
  }, [item]);

  // Audio change: jellyfin-web pattern — in Direct Play with native audioTracks
  // support, switch instantly without URL rebuild. Otherwise save position and
  // rebuild URL for remux/transcode. Don't reportStop() beforehand, as that kills
  // the Jellyfin transcode before the new one is ready (causing 400 on first .ts).
  const handleAudioChange = useCallback((idx: number) => {
    console.debug(DBG, "audio change", { newIndex: idx, position: positionRef.current, isDesktop, supportsNativeAudioTracks });
    audioOverrideRef.current = true;
    // jellyfin-web pattern (playbackmanager.js:setAudioStreamIndex): predict
    // whether the new audio track will stay in Direct Play (native switch).
    const newStream = streams.find((s) => s.Type === "Audio" && s.Index === idx);
    const codec = newStream?.Codec?.toLowerCase() ?? "";
    const channels = newStream?.Channels ?? 2;
    const newNeedsTranscode = /^(ac3|eac3|dts|truehd)$/i.test(codec) || channels > 6;
    const willStayDirectPlay = isDesktop
      ? quality == null
      : (quality == null && !newNeedsTranscode
         && (idx === defaultAudio || supportsNativeAudioTracks));
    // Only rebuild URL (save position) when exiting Direct Play.
    if (!willStayDirectPlay) {
      const ticks = getPositionTicks();
      if (ticks > 0) setStartTicks(ticks);
    }
    setAudioIndex(idx);
  }, [getPositionTicks, isDesktop, quality, streams, defaultAudio]);

  // jellyfin-web pattern (playbackmanager.js:setSubtitleStreamIndex): text subtitles
  // are switched client-side via <track> elements. Bitmap subtitles (PGS/DVDSUB)
  // require server burn-in — trigger URL rebuild with SubtitleStreamIndex.
  const handleSubtitleChange = useCallback((idx: number | null) => {
    if (idx != null) {
      const subStream = streams.find((s) => s.Type === "Subtitle" && s.Index === idx);
      const isBurnIn = BURN_IN_SUBTITLE_CODECS.test(subStream?.Codec ?? "");
      if (isBurnIn) {
        // Bitmap subtitle: save position and rebuild URL with burn-in.
        const ticks = getPositionTicks();
        if (ticks > 0) setStartTicks(ticks);
        setBurnInSubtitleIndex(idx);
        setSubtitleIndex(idx);
        return;
      }
    }
    // Text subtitle or disable: client-side handling via <track> elements.
    // If switching away from burn-in, rebuild URL without SubtitleStreamIndex.
    if (burnInSubtitleIndex != null) {
      const ticks = getPositionTicks();
      if (ticks > 0) setStartTicks(ticks);
      setBurnInSubtitleIndex(undefined);
    }
    setSubtitleIndex(idx);
  }, [streams, getPositionTicks, burnInSubtitleIndex]);

  const handleQualityChange = useCallback((bitrate: number | null) => {
    const ticks = getPositionTicks();
    console.debug(DBG, "quality change", { bitrate, position: positionRef.current, ticks });
    if (ticks > 0) setStartTicks(ticks);
    setQuality(bitrate);
  }, [getPositionTicks]);

  // Transcoded seeking: update startTicks to recompute stream URL
  const handleSeekRequest = useCallback((targetSeconds: number) => {
    console.debug(DBG, "seek request (transcoded)", { targetSeconds, ticks: Math.floor(targetSeconds * TICKS_PER_SECOND) });
    setStartTicks(Math.floor(targetSeconds * TICKS_PER_SECOND));
  }, []);

  const handleNextEpisode = useCallback(() => {
    if (nextEpisode) navigate(`/watch/${nextEpisode.Id}`, { replace: true });
  }, [nextEpisode, navigate]);

  const handlePreviousEpisode = useCallback(() => {
    if (previousEpisode) navigate(`/watch/${previousEpisode.Id}`, { replace: true });
  }, [previousEpisode, navigate]);

  const handleProgress = useCallback((seconds: number, paused: boolean) => {
    positionRef.current = seconds;
    updatePosition(seconds, paused);
  }, [updatePosition]);

  const handleSeekComplete = useCallback((seconds: number, paused: boolean) => {
    positionRef.current = seconds;
    reportSeek(seconds, paused);
  }, [reportSeek]);

  if (isLoading || !streamUrl) {
    return (
      <PlayerTransition transparent={isDesktop}>
        <div className="flex h-full w-full items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-tentacle-accent border-t-transparent" />
        </div>
      </PlayerTransition>
    );
  }

  const title = item?.Type === "Episode" ? item.SeriesName ?? item.Name : item?.Name ?? "";
  const epSubtitle = item?.Type === "Episode"
    ? `S${item.ParentIndexNumber}E${item.IndexNumber} — ${item.Name}` : undefined;
  const nextEpTitle = nextEpisode
    ? `S${nextEpisode.ParentIndexNumber}E${nextEpisode.IndexNumber} — ${nextEpisode.Name}` : undefined;

  const sharedProps = {
    src: streamUrl, title, subtitle: epSubtitle,
    startPositionSeconds, jellyfinDuration,
    audioTracks, subtitleTracks,
    currentAudio: audioIndex, currentSubtitle: subtitleIndex, currentQuality: quality,
    onAudioChange: handleAudioChange, onSubtitleChange: handleSubtitleChange, onQualityChange: handleQualityChange,
    onProgress: handleProgress, onStarted: reportStart,
    hasNextEpisode: !!nextEpisode, hasPreviousEpisode: !!previousEpisode,
    nextEpisodeTitle: nextEpTitle,
    onNextEpisode: handleNextEpisode, onPreviousEpisode: handlePreviousEpisode,
  };

  return (
    <PlayerTransition transparent={isDesktop}>
      {isDesktop ? (
        <DesktopPlayer key={itemId} {...sharedProps}
          isDirectPlay={isDirectPlay} streamOffset={streamOffset} posterUrl={posterUrl}
          introSegment={skipSegments.intro} creditsSegment={skipSegments.credits} />
      ) : (
        <VideoPlayer key={itemId} {...sharedProps}
          itemId={itemId!} isDirectPlay={isDirectPlay} streamOffset={streamOffset}
          onSeekRequest={handleSeekRequest} onSeekComplete={handleSeekComplete}
          introSegment={skipSegments.intro} creditsSegment={skipSegments.credits}
        />
      )}
    </PlayerTransition>
  );
}
