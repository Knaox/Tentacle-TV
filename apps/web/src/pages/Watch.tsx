import { useState, useMemo, useRef, useCallback, useEffect, lazy, Suspense } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMediaItem, useJellyfinClient, usePlaybackReporting, useResolveMediaTracks, useEpisodeNavigation, useIntroSkipper } from "@tentacle/api-client";
import { ticksToSeconds } from "@tentacle/shared";
import type { MediaStream as JfStream } from "@tentacle/shared";
import { VideoPlayer } from "../components/VideoPlayer";
import type { AudioTrack, SubtitleTrack } from "../components/VideoPlayer";
import { isTauri } from "../hooks/useDesktopPlayer";

const DesktopPlayer = lazy(() =>
  import("../components/DesktopPlayer").then((m) => ({ default: m.DesktopPlayer }))
);

import { TICKS_PER_SECOND } from "@tentacle/shared";

function formatTrackLabel(s: JfStream): string {
  const title = s.DisplayTitle || s.Title || s.Language || `Piste ${s.Index}`;
  const codec = s.Codec?.toUpperCase();
  const parts = [title];
  if (codec && !title.toUpperCase().includes(codec)) parts.push(codec);
  return parts.join(" - ");
}

export function Watch() {
  const { itemId } = useParams<{ itemId: string }>();
  const navigate = useNavigate();
  const client = useJellyfinClient();
  const { data: item, isLoading } = useMediaItem(itemId);
  const { nextEpisode, previousEpisode } = useEpisodeNavigation(item);

  const mediaSource = item?.MediaSources?.[0];
  const mediaSourceId = mediaSource?.Id ?? itemId;
  const streams: JfStream[] = mediaSource?.MediaStreams ?? [];

  const defaultAudio = streams.find((s) => s.Type === "Audio" && s.IsDefault)?.Index
    ?? streams.find((s) => s.Type === "Audio")?.Index ?? 0;

  const [audioIndex, setAudioIndex] = useState<number>(defaultAudio);
  const [subtitleIndex, setSubtitleIndex] = useState<number | null>(null);
  const [quality, setQuality] = useState<number | null>(null);
  const positionRef = useRef(0);
  const prefsApplied = useRef(false);

  // Detect unsupported codecs (AC3/EAC3/DTS not playable in Chrome/Firefox)
  const selectedAudioCodec = streams.find(
    (s) => s.Type === "Audio" && s.Index === audioIndex
  )?.Codec?.toLowerCase();
  const needsAudioTranscode = !!selectedAudioCodec && /^(ac3|eac3|dts|truehd)$/i.test(selectedAudioCodec);

  // Direct play only when default audio + no quality + browser-compatible codec
  const isDirectPlay = audioIndex === defaultAudio && quality == null && !needsAudioTranscode;

  // Skip intro/outro detection
  const skipSegments = useIntroSkipper(itemId, item);

  const { reportStart, updatePosition } = usePlaybackReporting(itemId, mediaSourceId, isDirectPlay);

  // Resolve preferred tracks from user preferences
  const resolveTracks = useResolveMediaTracks();
  useEffect(() => {
    if (prefsApplied.current || streams.length === 0 || !item) return;
    const libraryId = (item as any).ParentId || (item as any).SeriesId;
    if (!libraryId) return;

    prefsApplied.current = true;
    resolveTracks.mutate({
      libraryId,
      audioTracks: streams
        .filter((s) => s.Type === "Audio")
        .map((s) => ({ index: s.Index, language: s.Language, isDefault: s.IsDefault })),
      subtitleTracks: streams
        .filter((s) => s.Type === "Subtitle")
        .map((s) => ({ index: s.Index, language: s.Language, isForced: s.IsForced, title: s.DisplayTitle })),
    }, {
      onSuccess: (result) => {
        if (result.audioIndex != null) setAudioIndex(result.audioIndex);
        if (result.subtitleIndex != null) setSubtitleIndex(result.subtitleIndex);
      },
    });
  }, [streams, item]);

  const streamUrl = useMemo(() => {
    if (!itemId) return null;
    return client.getStreamUrl(itemId, {
      audioIndex,
      mediaSourceId,
      maxBitrate: quality ?? undefined,
      directPlay: isDirectPlay,
    });
  }, [client, itemId, audioIndex, mediaSourceId, quality, isDirectPlay]);

  const audioTracks: AudioTrack[] = useMemo(() =>
    streams
      .filter((s) => s.Type === "Audio")
      .map((s) => ({
        index: s.Index,
        label: formatTrackLabel(s),
      })),
    [streams]
  );

  const subtitleTracks: SubtitleTrack[] = useMemo(() =>
    streams
      .filter((s) => s.Type === "Subtitle")
      .map((s) => ({
        index: s.Index,
        label: formatTrackLabel(s),
        url: client.getSubtitleUrl(itemId!, mediaSourceId!, s.Index),
      })),
    [streams, client, itemId, mediaSourceId]
  );

  const jellyfinDuration = useMemo(() => ticksToSeconds(item?.RunTimeTicks), [item]);

  const startPositionSeconds = useMemo(() => {
    const ticks = item?.UserData?.PlaybackPositionTicks;
    return ticks ? ticks / TICKS_PER_SECOND : undefined;
  }, [item]);

  const handleAudioChange = useCallback((idx: number) => {
    setAudioIndex(idx);
  }, []);

  const handleQualityChange = useCallback((bitrate: number | null) => {
    setQuality(bitrate);
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

  if (isLoading || !streamUrl) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-black">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-tentacle-accent border-t-transparent" />
      </div>
    );
  }

  const title = item?.Type === "Episode" ? item.SeriesName ?? item.Name : item?.Name ?? "";
  const subtitle = item?.Type === "Episode"
    ? `S${item.ParentIndexNumber}E${item.IndexNumber} — ${item.Name}` : undefined;

  const nextEpTitle = nextEpisode
    ? `S${nextEpisode.ParentIndexNumber}E${nextEpisode.IndexNumber} — ${nextEpisode.Name}`
    : undefined;

  const playerProps = {
    src: streamUrl,
    title,
    subtitle,
    startPositionSeconds,
    jellyfinDuration,
    audioTracks,
    subtitleTracks,
    currentAudio: audioIndex,
    currentSubtitle: subtitleIndex,
    currentQuality: quality,
    onAudioChange: handleAudioChange,
    onSubtitleChange: setSubtitleIndex,
    onQualityChange: handleQualityChange,
    onProgress: handleProgress,
    onStarted: reportStart,
    hasNextEpisode: !!nextEpisode,
    hasPreviousEpisode: !!previousEpisode,
    nextEpisodeTitle: nextEpTitle,
    onNextEpisode: handleNextEpisode,
    onPreviousEpisode: handlePreviousEpisode,
    introSegment: skipSegments.intro,
    creditsSegment: skipSegments.credits,
  };

  // Use mpv player on desktop (Tauri), HTML5 player on web
  if (isTauri()) {
    return (
      <Suspense fallback={
        <div className="flex h-screen w-screen items-center justify-center bg-black">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-tentacle-accent border-t-transparent" />
        </div>
      }>
        <DesktopPlayer {...playerProps} />
      </Suspense>
    );
  }

  return <VideoPlayer {...playerProps} />;
}
