import { useState, useMemo, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useMediaItem, useJellyfinClient, usePlaybackReporting } from "@tentacle/api-client";
import type { MediaStream as JfStream } from "@tentacle/shared";
import { VideoPlayer } from "../components/VideoPlayer";
import type { AudioTrack, SubtitleTrack } from "../components/VideoPlayer";

const TICKS_PER_SEC = 10_000_000;

export function Watch() {
  const { itemId } = useParams<{ itemId: string }>();
  const client = useJellyfinClient();
  const { data: item, isLoading } = useMediaItem(itemId);

  const mediaSource = item?.MediaSources?.[0];
  const mediaSourceId = mediaSource?.Id ?? itemId;
  const streams: JfStream[] = mediaSource?.MediaStreams ?? [];

  const defaultAudio = streams.find((s) => s.Type === "Audio" && s.IsDefault)?.Index
    ?? streams.find((s) => s.Type === "Audio")?.Index ?? 0;

  const [audioIndex, setAudioIndex] = useState<number>(defaultAudio);
  const [subtitleIndex, setSubtitleIndex] = useState<number | null>(null);
  const [quality, setQuality] = useState<number | null>(null);
  const positionRef = useRef(0);

  const { reportStart, updatePosition } = usePlaybackReporting(itemId, mediaSourceId);

  const streamUrl = useMemo(() => {
    if (!itemId) return null;
    return client.getStreamUrl(itemId, {
      audioIndex,
      mediaSourceId,
      maxBitrate: quality ?? undefined,
    });
  }, [client, itemId, audioIndex, mediaSourceId, quality]);

  const audioTracks: AudioTrack[] = useMemo(() =>
    streams
      .filter((s) => s.Type === "Audio")
      .map((s) => ({
        index: s.Index,
        label: [s.DisplayTitle || s.Language || `Audio ${s.Index}`, s.Codec?.toUpperCase()].filter(Boolean).join(" - "),
      })),
    [streams]
  );

  const subtitleTracks: SubtitleTrack[] = useMemo(() =>
    streams
      .filter((s) => s.Type === "Subtitle")
      .map((s) => ({
        index: s.Index,
        label: s.DisplayTitle || s.Language || `Sous-titre ${s.Index}`,
        url: client.getSubtitleUrl(itemId!, mediaSourceId!, s.Index),
      })),
    [streams, client, itemId, mediaSourceId]
  );

  const startPositionSeconds = useMemo(() => {
    const ticks = item?.UserData?.PlaybackPositionTicks;
    return ticks ? ticks / TICKS_PER_SEC : undefined;
  }, [item]);

  const handleAudioChange = useCallback((idx: number) => {
    positionRef.current = 0; // Will be set by progress callback before rebuild
    setAudioIndex(idx);
  }, []);

  const handleQualityChange = useCallback((bitrate: number | null) => {
    setQuality(bitrate);
  }, []);

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

  return (
    <VideoPlayer
      src={streamUrl}
      title={title}
      subtitle={subtitle}
      startPositionSeconds={startPositionSeconds}
      audioTracks={audioTracks}
      subtitleTracks={subtitleTracks}
      currentAudio={audioIndex}
      currentSubtitle={subtitleIndex}
      currentQuality={quality}
      onAudioChange={handleAudioChange}
      onSubtitleChange={setSubtitleIndex}
      onQualityChange={handleQualityChange}
      onProgress={handleProgress}
      onStarted={reportStart}
    />
  );
}
