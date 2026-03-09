import { useCallback, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { usePlaybackReporting } from "@tentacle-tv/api-client";
import type { MediaStream as JfStream } from "@tentacle-tv/shared";
import { DesktopPlayer } from "../components/DesktopPlayer";
import { PlayerTransition } from "../components/PlayerTransition";
import { useWatchSession, BURN_IN_SUBTITLE_CODECS } from "../hooks/useWatchSession";

export function WatchDesktop() {
  const queryClient = useQueryClient();
  const {
    itemId, item, isLoading, client, streams, mediaSourceId,
    audioIndex, setAudioIndex, subtitleIndex, setSubtitleIndex,
    quality, setQuality, setStartTicks,
    burnInSubtitleIndex, setBurnInSubtitleIndex,
    positionRef, audioOverrideRef, subtitleOverrideRef,
    isDirectPlay, isDirectStream, playSessionId, streamUrl, streamOffset,
    audioTracks, subtitleTracks,
    jellyfinDuration, startPositionSeconds, posterUrl,
    nextEpisode, previousEpisode, handleNextEpisode, handlePreviousEpisode,
    skipSegments, autoplayCreditsSeconds, getPositionTicks,
  } = useWatchSession({ isDesktop: true, checkAudioTranscode: () => false });

  const { reportStart, updatePosition, reportSeek: _reportSeek, killTranscode, lastStopPromiseRef } = usePlaybackReporting({
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

  const handleAudioChange = useCallback(async (idx: number) => {
    audioOverrideRef.current = true;
    // In transcode mode (quality override), kill old ffmpeg before URL rebuild
    if (quality != null) {
      await killTranscode();
      const ticks = getPositionTicks();
      if (ticks > 0) setStartTicks(ticks);
    }
    setAudioIndex(idx);
  }, [quality, killTranscode, getPositionTicks, setStartTicks, setAudioIndex, audioOverrideRef]);

  const handleSubtitleChange = useCallback(async (idx: number | null) => {
    subtitleOverrideRef.current = true;
    // In direct play, mpv handles all subtitle types natively — just update state
    if (isDirectPlay) { setSubtitleIndex(idx); return; }
    // In transcode mode, bitmap subtitles need server burn-in
    if (idx != null) {
      const sub = streams.find((s: JfStream) => s.Type === "Subtitle" && s.Index === idx);
      if (BURN_IN_SUBTITLE_CODECS.test(sub?.Codec ?? "")) {
        await killTranscode();
        const ticks = getPositionTicks();
        if (ticks > 0) setStartTicks(ticks);
        setBurnInSubtitleIndex(idx);
        setSubtitleIndex(idx);
        return;
      }
    }
    if (burnInSubtitleIndex != null) {
      await killTranscode();
      const ticks = getPositionTicks();
      if (ticks > 0) setStartTicks(ticks);
      setBurnInSubtitleIndex(undefined);
    }
    setSubtitleIndex(idx);
  }, [isDirectPlay, streams, killTranscode, getPositionTicks, burnInSubtitleIndex, setStartTicks, setBurnInSubtitleIndex, setSubtitleIndex]);

  const handleQualityChange = useCallback(async (bitrate: number | null) => {
    await killTranscode();
    const ticks = getPositionTicks();
    if (ticks > 0) setStartTicks(ticks);
    setQuality(bitrate);
  }, [killTranscode, getPositionTicks, setQuality, setStartTicks]);

  const handleProgress = useCallback((seconds: number, paused: boolean) => {
    positionRef.current = seconds;
    updatePosition(seconds, paused);
  }, [updatePosition, positionRef]);

  if (isLoading || !streamUrl) {
    return (
      <PlayerTransition transparent>
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
    <PlayerTransition transparent>
      <DesktopPlayer
        key={itemId} src={streamUrl} title={title} subtitle={epSubtitle}
        startPositionSeconds={startPositionSeconds} jellyfinDuration={jellyfinDuration}
        audioTracks={audioTracks} subtitleTracks={subtitleTracks}
        currentAudio={audioIndex} currentSubtitle={subtitleIndex} currentQuality={quality}
        onAudioChange={handleAudioChange} onSubtitleChange={handleSubtitleChange} onQualityChange={handleQualityChange}
        onProgress={handleProgress} onStarted={() => reportStart(startPositionSeconds)}
        hasNextEpisode={!!nextEpisode} hasPreviousEpisode={!!previousEpisode}
        nextEpisodeTitle={nextEpTitle} nextEpisodeImageUrl={nextEpisodeImageUrl}
        nextEpisodeDescription={nextEpisodeDescription} autoplayCreditsSeconds={autoplayCreditsSeconds}
        onNextEpisode={handleNextEpisode} onPreviousEpisode={handlePreviousEpisode}
        isDirectPlay={isDirectPlay} streamOffset={streamOffset} posterUrl={posterUrl}
        introSegment={skipSegments.intro} creditsSegment={skipSegments.credits}
        itemId={itemId!}
      />
    </PlayerTransition>
  );
}
