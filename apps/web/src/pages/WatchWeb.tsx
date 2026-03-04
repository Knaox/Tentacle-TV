import { useCallback, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { usePlaybackReporting } from "@tentacle-tv/api-client";
import { TICKS_PER_SECOND } from "@tentacle-tv/shared";
import type { MediaStream as JfStream } from "@tentacle-tv/shared";
import { VideoPlayer } from "../components/VideoPlayer";
import { PlayerTransition } from "../components/PlayerTransition";
import { useWatchSession, BURN_IN_SUBTITLE_CODECS } from "../hooks/useWatchSession";

export function WatchWeb() {
  const queryClient = useQueryClient();
  const {
    itemId, item, isLoading, client, streams, mediaSourceId,
    audioIndex, setAudioIndex, subtitleIndex, setSubtitleIndex,
    quality, setQuality, setStartTicks,
    burnInSubtitleIndex, setBurnInSubtitleIndex,
    positionRef, audioOverrideRef,
    isDirectPlay, isDirectStream, playSessionId, streamUrl, streamOffset,
    audioTracks, subtitleTracks,
    jellyfinDuration, startPositionSeconds,
    nextEpisode, previousEpisode, handleNextEpisode, handlePreviousEpisode,
    skipSegments, autoplayCreditsSeconds, getPositionTicks,
  } = useWatchSession({ isDesktop: false });

  const { reportStart, updatePosition, reportSeek, killTranscode, lastStopPromiseRef } = usePlaybackReporting({
    itemId, mediaSourceId, isDirectPlay, isDirectStream, playSessionId,
    audioStreamIndex: audioIndex, subtitleStreamIndex: subtitleIndex,
  });

  useEffect(() => {
    return () => {
      const id = itemId;
      queryClient.removeQueries({ queryKey: ["item", id] });
      const invalidateAll = () => {
        queryClient.invalidateQueries({ queryKey: ["item", id] });
        queryClient.invalidateQueries({ queryKey: ["resume-items"] });
        queryClient.invalidateQueries({ queryKey: ["next-up"] });
        queryClient.invalidateQueries({ queryKey: ["watched-items"] });
      };
      lastStopPromiseRef.current.then(invalidateAll, invalidateAll);
    };
  }, [itemId, queryClient, lastStopPromiseRef]);

  // Audio change: save position for potential transcode restart.
  // Server decides direct play vs transcode via PlaybackInfo.
  const handleAudioChange = useCallback((idx: number) => {
    audioOverrideRef.current = true;
    const ticks = getPositionTicks();
    if (ticks > 0) setStartTicks(ticks);
    setAudioIndex(idx);
  }, [getPositionTicks, setStartTicks, setAudioIndex, audioOverrideRef]);

  const handleSubtitleChange = useCallback((idx: number | null) => {
    if (idx != null) {
      const sub = streams.find((s: JfStream) => s.Type === "Subtitle" && s.Index === idx);
      if (BURN_IN_SUBTITLE_CODECS.test(sub?.Codec ?? "")) {
        const ticks = getPositionTicks();
        if (ticks > 0) setStartTicks(ticks);
        setBurnInSubtitleIndex(idx);
        setSubtitleIndex(idx);
        return;
      }
    }
    if (burnInSubtitleIndex != null) {
      const ticks = getPositionTicks();
      if (ticks > 0) setStartTicks(ticks);
      setBurnInSubtitleIndex(undefined);
    }
    setSubtitleIndex(idx);
  }, [streams, getPositionTicks, burnInSubtitleIndex, setStartTicks, setBurnInSubtitleIndex, setSubtitleIndex]);

  const handleQualityChange = useCallback((bitrate: number | null) => {
    const ticks = getPositionTicks();
    if (ticks > 0) setStartTicks(ticks);
    setQuality(bitrate);
  }, [getPositionTicks, setStartTicks, setQuality]);

  // HLS seek fallback: kill old transcode, PlaybackInfo re-fetches with new position.
  const handleSeekRequest = useCallback((targetSeconds: number) => {
    if (!isDirectPlay) killTranscode();
    setStartTicks(Math.floor(targetSeconds * TICKS_PER_SECOND));
  }, [isDirectPlay, killTranscode, setStartTicks]);

  const handleProgress = useCallback((seconds: number, paused: boolean) => {
    positionRef.current = seconds;
    updatePosition(seconds, paused);
  }, [updatePosition, positionRef]);

  const handleSeekComplete = useCallback((seconds: number, paused: boolean) => {
    positionRef.current = seconds;
    reportSeek(seconds, paused);
  }, [reportSeek, positionRef]);

  if (isLoading || !streamUrl) {
    return (
      <PlayerTransition transparent={false}>
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
  const nextEpisodeImageUrl = nextEpisode?.Id
    ? client.getImageUrl(nextEpisode.Id, "Primary", { height: 200, quality: 85 }) : undefined;
  const nextEpisodeDescription = nextEpisode?.Overview
    ? (nextEpisode.Overview.length > 120 ? nextEpisode.Overview.slice(0, 120) + "…" : nextEpisode.Overview) : undefined;

  return (
    <PlayerTransition transparent={false}>
      <VideoPlayer
        key={itemId} src={streamUrl} title={title} subtitle={epSubtitle}
        startPositionSeconds={startPositionSeconds} jellyfinDuration={jellyfinDuration}
        audioTracks={audioTracks} subtitleTracks={subtitleTracks}
        currentAudio={audioIndex} currentSubtitle={subtitleIndex} currentQuality={quality}
        onAudioChange={handleAudioChange} onSubtitleChange={handleSubtitleChange} onQualityChange={handleQualityChange}
        onProgress={handleProgress} onStarted={reportStart}
        hasNextEpisode={!!nextEpisode} hasPreviousEpisode={!!previousEpisode}
        nextEpisodeTitle={nextEpTitle} nextEpisodeImageUrl={nextEpisodeImageUrl}
        nextEpisodeDescription={nextEpisodeDescription} autoplayCreditsSeconds={autoplayCreditsSeconds}
        onNextEpisode={handleNextEpisode} onPreviousEpisode={handlePreviousEpisode}
        itemId={itemId!} isDirectPlay={isDirectPlay} streamOffset={streamOffset}
        onSeekRequest={handleSeekRequest} onSeekComplete={handleSeekComplete}
        introSegment={skipSegments.intro} creditsSegment={skipSegments.credits}
      />
    </PlayerTransition>
  );
}
