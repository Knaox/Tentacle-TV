import { useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { usePlaybackReporting, useWatchStopInvalidation } from "@tentacle-tv/api-client";
import type { MediaStream as JfStream, QualityKey } from "@tentacle-tv/shared";
import { DesktopPlayer } from "../components/DesktopPlayer";
import { PlayerLoadingScreen } from "../components/player/PlayerLoadingScreen";
import { useWatchSession, BURN_IN_SUBTITLE_CODECS } from "../hooks/useWatchSession";
import { useGroupSyncEngine } from "../watchTogether/useGroupSyncEngine";
import { useGroupPlaybackHandlers } from "../watchTogether/useGroupPlaybackHandlers";
import { GroupPlaybackOverlay } from "../watchTogether/GroupPlaybackOverlay";
import type { PlayerTransport } from "../watchTogether/playerTransport";
import { useApplyToSeries } from "../hooks/useApplyToSeries";

export function WatchDesktop({ onFallbackToWeb }: { onFallbackToWeb?: () => void } = {}) {
  const queryClient = useQueryClient();
  const {
    itemId, item, isLoading, client, streams, mediaSourceId,
    audioIndex, setAudioIndex, subtitleIndex, setSubtitleIndex,
    qualityKey, setQualityKey, sourceQuality, setStartTicks,
    burnInSubtitleIndex, setBurnInSubtitleIndex,
    positionRef, audioOverrideRef, subtitleOverrideRef,
    isDirectPlay, isDirectStream, playSessionId, streamUrl, streamOffset,
    audioTracks, subtitleTracks,
    jellyfinDuration, startPositionSeconds, posterUrl,
    nextEpisode, previousEpisode, handleNextEpisode, handlePreviousEpisode,
    skipSegments, autoplayNextEnabled, maxResumePct, getPositionTicks,
  } = useWatchSession({ isDesktop: true, checkAudioTranscode: () => false });

  const { reportStart, updatePosition, reportSeek: _reportSeek, killTranscode, lastStopPromiseRef } = usePlaybackReporting({
    itemId, mediaSourceId, isDirectPlay, isDirectStream, playSessionId,
    audioStreamIndex: audioIndex, subtitleStreamIndex: subtitleIndex,
  });

  // ── Watch Together : transport + handlers de groupe + moteur de sync ──
  const transportRef = useRef<PlayerTransport | null>(null);
  const group = useGroupPlaybackHandlers({
    itemId, itemReady: !!item, resumePositionSeconds: startPositionSeconds,
    nextEpisode, previousEpisode, handleNextEpisode, handlePreviousEpisode, setStartTicks,
  });
  const groupSync = useGroupSyncEngine({
    itemId, transportRef, claimStartSeconds: group.groupStartPositionSeconds,
  });

  // Rebuild de source local (changement qualité/audio/burn-in) : le groupe
  // attend ce membre pendant le rechargement (fileLoaded+playing → false).
  const firstSrcRef = useRef(true);
  useEffect(() => {
    if (!streamUrl) return;
    if (firstSrcRef.current) { firstSrcRef.current = false; return; }
    groupSync.notifyBuffering(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamUrl]);

  // Épisode : « Appliquer à cette série » (préférence de langues par série).
  const applyToSeries = useApplyToSeries({ item, streams, audioIndex, subtitleIndex });

  const runStopInvalidation = useWatchStopInvalidation();
  const itemRef = useRef(item);
  itemRef.current = item;

  useEffect(() => {
    return () => {
      const id = itemId;
      const snap = itemRef.current;
      queryClient.removeQueries({ queryKey: ["item", id] });
      // Cleanups React s'exécutent en ordre inverse d'enregistrement : ce
      // cleanup tourne AVANT celui de usePlaybackReporting qui assigne le vrai
      // stop promise. On défère donc la lecture du ref à un microtask pour
      // chaîner l'invalidation APRÈS le /Sessions/Playing/Stopped (Jellyfin a
      // alors mis à jour Played/DatePlayed → décision « 100% vu » fiable).
      queueMicrotask(() => {
        const run = () =>
          runStopInvalidation({ itemId: id, seriesId: snap?.SeriesId, itemType: snap?.Type });
        lastStopPromiseRef.current.then(run, run);
      });
    };
  }, [itemId, queryClient, lastStopPromiseRef, runStopInvalidation]);

  const handleAudioChange = useCallback(async (idx: number) => {
    audioOverrideRef.current = true;
    // In transcode mode (quality override), kill old ffmpeg before URL rebuild
    if (qualityKey !== "original") {
      await killTranscode();
      const ticks = getPositionTicks();
      if (ticks > 0) setStartTicks(ticks);
    }
    setAudioIndex(idx);
  }, [qualityKey, killTranscode, getPositionTicks, setStartTicks, setAudioIndex, audioOverrideRef]);

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

  const handleQualityChange = useCallback(async (key: QualityKey) => {
    await killTranscode();
    const ticks = getPositionTicks();
    if (ticks > 0) setStartTicks(ticks);
    setQualityKey(key);
  }, [killTranscode, getPositionTicks, setQualityKey, setStartTicks]);

  const handleProgress = useCallback((seconds: number, paused: boolean) => {
    positionRef.current = seconds;
    updatePosition(seconds, paused);
  }, [updatePosition, positionRef]);

  const title = item?.Type === "Episode" ? item.SeriesName ?? item.Name : item?.Name ?? "";
  const epSubtitle = item?.Type === "Episode"
    ? `S${item.ParentIndexNumber}E${item.IndexNumber} — ${item.Name}` : undefined;

  if (isLoading || !streamUrl) {
    return <PlayerLoadingScreen posterUrl={posterUrl} title={title || undefined} subtitle={epSubtitle} />;
  }

  const nextEpTitle = nextEpisode
    ? `S${nextEpisode.ParentIndexNumber}E${nextEpisode.IndexNumber} — ${nextEpisode.Name}` : undefined;
  const nextEpisodeImageUrl = (() => {
    if (!nextEpisode?.Id) return undefined;
    const hasOwnBackdrop = (nextEpisode.BackdropImageTags?.length ?? 0) > 0;
    const hasParentBackdrop = (nextEpisode.ParentBackdropImageTags?.length ?? 0) > 0;
    const isEpisode = nextEpisode.Type === "Episode";
    const backdropId = isEpisode
      ? (hasOwnBackdrop ? nextEpisode.Id : (nextEpisode.ParentBackdropItemId ?? nextEpisode.SeriesId ?? nextEpisode.Id))
      : nextEpisode.Id;
    const imageType = (hasOwnBackdrop || hasParentBackdrop) ? "Backdrop" : "Primary";
    return client.getImageUrl(backdropId, imageType, { width: 1920, quality: 85 });
  })();
  // Fond immersif de l'affiche de fin = bannière de la SÉRIE (fallback : backdrop épisode).
  const nextSeriesBackdropUrl = (() => {
    if (!nextEpisode?.Id) return undefined;
    const seriesId = nextEpisode.SeriesId ?? nextEpisode.ParentBackdropItemId;
    if (seriesId) return client.getImageUrl(seriesId, "Backdrop", { width: 1920, quality: 85 });
    return (nextEpisode.BackdropImageTags?.length ?? 0) > 0
      ? client.getImageUrl(nextEpisode.Id, "Backdrop", { width: 1920, quality: 85 })
      : nextEpisodeImageUrl;
  })();
  // Vignette de l'épisode suivant = image Primary (miniature).
  const nextEpisodeThumbUrl = nextEpisode?.Id
    ? client.getImageUrl(nextEpisode.Id, "Primary", { width: 500, quality: 90 })
    : nextEpisodeImageUrl;
  const nextEpisodeDescription = nextEpisode?.Overview
    ? (nextEpisode.Overview.length > 300 ? nextEpisode.Overview.slice(0, 300) + "…" : nextEpisode.Overview) : undefined;

  return (
    <div className="relative h-screen w-screen">
      <DesktopPlayer
        key={itemId} src={streamUrl} title={title} subtitle={epSubtitle}
        startPositionSeconds={group.groupStartPositionSeconds ?? startPositionSeconds} jellyfinDuration={jellyfinDuration}
        audioTracks={audioTracks} subtitleTracks={subtitleTracks}
        currentAudio={audioIndex} currentSubtitle={subtitleIndex} currentQuality={qualityKey} sourceQuality={sourceQuality}
        onAudioChange={handleAudioChange} onSubtitleChange={handleSubtitleChange} onQualityChange={handleQualityChange}
        onProgress={handleProgress} onStarted={() => reportStart(group.groupStartPositionSeconds ?? startPositionSeconds)}
        hasNextEpisode={!!nextEpisode} hasPreviousEpisode={!!previousEpisode}
        nextEpisodeTitle={nextEpTitle} nextEpisodeImageUrl={nextEpisodeImageUrl}
        nextSeriesBackdropUrl={nextSeriesBackdropUrl} nextEpisodeThumbUrl={nextEpisodeThumbUrl}
        nextEpisodeDescription={nextEpisodeDescription} autoplayNextEnabled={autoplayNextEnabled} maxResumePct={maxResumePct}
        onNextEpisode={group.handleNextEpisode} onPreviousEpisode={group.handlePreviousEpisode}
        isDirectPlay={isDirectPlay} streamOffset={streamOffset} posterUrl={posterUrl}
        introSegment={skipSegments.intro} creditsSegment={skipSegments.credits}
        itemId={itemId!} item={item} mediaSourceId={mediaSourceId}
        onFallbackToWeb={onFallbackToWeb}
        transportRef={transportRef} onPlayStateChange={groupSync.notifyPlayState}
        onBufferingChange={groupSync.notifyBuffering}
        onSeekComplete={(seconds) => groupSync.notifySeek(seconds)}
        onAutoNextDismiss={groupSync.notifyAutoNextDismiss}
        onApplyToSeries={applyToSeries}
      />
      <GroupPlaybackOverlay itemId={itemId} />
    </div>
  );
}
