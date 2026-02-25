import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMediaItem, useJellyfinClient, usePlaybackReporting, useResolveMediaTracks, useEpisodeNavigation, useIntroSkipper } from "@tentacle/api-client";
import { ticksToSeconds, TICKS_PER_SECOND } from "@tentacle/shared";
import type { MediaStream as JfStream } from "@tentacle/shared";
import { VideoPlayer } from "../components/VideoPlayer";
import type { AudioTrack, SubtitleTrack } from "../components/VideoPlayer";
import { PlayerTransition } from "../components/PlayerTransition";

function formatTrackLabel(s: JfStream): string {
  const title = s.DisplayTitle || s.Title || s.Language || `Piste ${s.Index}`;
  const codec = s.Codec?.toUpperCase();
  const parts = [title];
  if (codec && !title.toUpperCase().includes(codec)) parts.push(codec);
  return parts.join(" - ");
}

const DBG = "[Tentacle:Player]";

export function Watch() {
  const { itemId } = useParams<{ itemId: string }>();
  const navigate = useNavigate();
  const client = useJellyfinClient();
  const { data: item, isLoading } = useMediaItem(itemId);
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
  const positionRef = useRef(0);
  const prefsApplied = useRef(false);
  const audioOverrideRef = useRef(false);
  const [transitionDone, setTransitionDone] = useState(false);

  // Reset state when switching episodes
  useEffect(() => {
    console.debug(DBG, "episode switch — resetting state", { itemId });
    setStartTicks(0);
    setQuality(null);
    setSubtitleIndex(null);
    positionRef.current = 0;
    prefsApplied.current = false;
    audioOverrideRef.current = false;
  }, [itemId]);

  // Sync audioIndex when streams change (new episode loaded)
  // Skip if user explicitly changed audio to prevent refetch from resetting their choice
  useEffect(() => {
    if (streams.length > 0 && !audioOverrideRef.current) {
      const defAudio = streams.find((s) => s.Type === "Audio" && s.IsDefault)?.Index
        ?? streams.find((s) => s.Type === "Audio")?.Index ?? 0;
      setAudioIndex(defAudio);
    }
  }, [streams]);

  const selectedAudioCodec = streams.find(
    (s) => s.Type === "Audio" && s.Index === audioIndex
  )?.Codec?.toLowerCase();
  const needsAudioTranscode = !!selectedAudioCodec && /^(ac3|eac3|dts|truehd)$/i.test(selectedAudioCodec);
  const isDirectPlay = audioIndex === defaultAudio && quality == null && !needsAudioTranscode;

  console.debug(DBG, "playback mode", {
    isDirectPlay, audioIndex, defaultAudio, selectedAudioCodec, needsAudioTranscode,
    quality, streamCount: streams.length,
  });

  const skipSegments = useIntroSkipper(itemId, item);
  const { reportStart, reportStop, updatePosition } = usePlaybackReporting(itemId, mediaSourceId, isDirectPlay);

  // Resolve preferred tracks
  const resolveTracks = useResolveMediaTracks();
  useEffect(() => {
    if (prefsApplied.current || streams.length === 0 || !item) return;
    const parentId = (item as any).ParentId;
    const seriesId = (item as any).SeriesId;
    const libraryId = parentId || seriesId;
    if (!libraryId) return;
    prefsApplied.current = true;
    resolveTracks.mutate({
      libraryId,
      libraryIds: [parentId, seriesId].filter(Boolean) as string[],
      audioTracks: streams.filter((s) => s.Type === "Audio")
        .map((s) => ({ index: s.Index, language: s.Language, isDefault: s.IsDefault })),
      subtitleTracks: streams.filter((s) => s.Type === "Subtitle")
        .map((s) => ({ index: s.Index, language: s.Language, isForced: s.IsForced, title: s.DisplayTitle })),
    }, {
      onSuccess: (result) => {
        console.debug(DBG, "preferences resolved", { audio: result.audioIndex, subtitle: result.subtitleIndex, currentPosition: positionRef.current });
        if (result.audioIndex != null) {
          // Preserve current position when preferences switch to a non-default audio track
          // (this will trigger transcode mode which needs startTicks for the stream URL)
          if (positionRef.current > 0) {
            setStartTicks(Math.floor(positionRef.current * TICKS_PER_SECOND));
          }
          setAudioIndex(result.audioIndex);
        }
        // -1 = explicitly disabled, positive = specific track, null = no preference
        if (result.subtitleIndex != null) {
          setSubtitleIndex(result.subtitleIndex === -1 ? null : result.subtitleIndex);
        }
      },
    });
  }, [streams, item]); // eslint-disable-line react-hooks/exhaustive-deps

  const streamUrl = useMemo(() => {
    if (!itemId) return null;
    const url = client.getStreamUrl(itemId, {
      audioIndex,
      subtitleIndex: subtitleIndex ?? -1,
      mediaSourceId,
      maxBitrate: quality ?? undefined,
      directPlay: isDirectPlay,
      startTimeTicks: !isDirectPlay && startTicks > 0 ? startTicks : undefined,
    });
    console.debug(DBG, "stream URL built", { url: url?.substring(0, 120) + "...", isDirectPlay, startTicks });
    return url;
  }, [client, itemId, audioIndex, subtitleIndex, mediaSourceId, quality, isDirectPlay, startTicks]);

  // Stream offset in seconds (for transcoded seeking)
  const streamOffset = !isDirectPlay && startTicks > 0 ? startTicks / TICKS_PER_SECOND : 0;

  const audioTracks: AudioTrack[] = useMemo(() =>
    streams.filter((s) => s.Type === "Audio")
      .map((s) => ({ index: s.Index, label: formatTrackLabel(s) })),
    [streams]
  );

  const subtitleTracks: SubtitleTrack[] = useMemo(() =>
    streams.filter((s) => s.Type === "Subtitle")
      .map((s) => ({ index: s.Index, label: formatTrackLabel(s), url: client.getSubtitleUrl(itemId!, mediaSourceId!, s.Index) })),
    [streams, client, itemId, mediaSourceId]
  );

  const jellyfinDuration = useMemo(() => ticksToSeconds(item?.RunTimeTicks), [item]);
  const startPositionSeconds = useMemo(() => {
    const ticks = item?.UserData?.PlaybackPositionTicks;
    return ticks ? ticks / TICKS_PER_SECOND : undefined;
  }, [item]);

  // Audio change: stop old session, save position, then start new stream
  const handleAudioChange = useCallback((idx: number) => {
    console.debug(DBG, "audio change", { newIndex: idx, position: positionRef.current });
    // Stop current Jellyfin session so the old transcode is cleaned up
    reportStop();
    if (positionRef.current > 0) {
      setStartTicks(Math.floor(positionRef.current * TICKS_PER_SECOND));
    }
    audioOverrideRef.current = true;
    setAudioIndex(idx);
  }, [reportStop]);

  const handleQualityChange = useCallback((bitrate: number | null) => {
    console.debug(DBG, "quality change", { bitrate, position: positionRef.current });
    reportStop();
    if (positionRef.current > 0) {
      setStartTicks(Math.floor(positionRef.current * TICKS_PER_SECOND));
    }
    setQuality(bitrate);
  }, [reportStop]);

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

  if (isLoading || !streamUrl) {
    return (
      <PlayerTransition>
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

  const playerProps = {
    src: streamUrl, title, subtitle: epSubtitle,
    startPositionSeconds, jellyfinDuration,
    audioTracks, subtitleTracks,
    currentAudio: audioIndex, currentSubtitle: subtitleIndex, currentQuality: quality,
    isDirectPlay, streamOffset,
    onAudioChange: handleAudioChange, onSubtitleChange: setSubtitleIndex, onQualityChange: handleQualityChange,
    onProgress: handleProgress, onStarted: reportStart, onSeekRequest: handleSeekRequest,
    hasNextEpisode: !!nextEpisode, hasPreviousEpisode: !!previousEpisode,
    nextEpisodeTitle: nextEpTitle,
    onNextEpisode: handleNextEpisode, onPreviousEpisode: handlePreviousEpisode,
    introSegment: skipSegments.intro, creditsSegment: skipSegments.credits,
    readyToPlay: transitionDone,
  };

  return (
    <PlayerTransition onComplete={() => setTransitionDone(true)}>
      <VideoPlayer {...playerProps} />
    </PlayerTransition>
  );
}

