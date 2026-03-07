import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { View, StatusBar, Platform } from "react-native";
import Video, { type OnProgressData, type OnLoadData, type VideoRef, SelectedTrackType, type ISO639_1 } from "react-native-video";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import * as ScreenOrientation from "expo-screen-orientation";
import { TICKS_PER_SECOND } from "@tentacle-tv/shared";
import { useTranslation } from "react-i18next";
import { usePlayerPlayback } from "../hooks/usePlayerPlayback";
import { usePlayerPreferences } from "../hooks/usePlayerPreferences";
import { formatTrackLabel } from "../lib/playerUtils";
import { MobilePlayerOverlay } from "../components/MobilePlayerOverlay";
import { PlayerLoadingView } from "../components/player/PlayerLoadingView";
import { PlayerErrorView } from "../components/player/PlayerErrorView";
import { PlayerGestures } from "../components/player/PlayerGestures";

interface Props { itemId: string }

export function PlayerScreen({ itemId }: Props) {
  const { t } = useTranslation("player");
  const router = useRouter();
  const queryClient = useQueryClient();
  const videoRef = useRef<VideoRef>(null);

  const pb = usePlayerPlayback(itemId);
  const [paused, setPaused] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [bufferedTime, setBufferedTime] = useState(0);
  const [isBuffering, setIsBuffering] = useState(true);
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [videoReady, setVideoReady] = useState(false);
  const resumeApplied = useRef(false);
  const retryCount = useRef(0);
  const hasEverPlayed = useRef(false);

  // Orientation: landscape on mount, portrait on unmount
  useEffect(() => {
    if (Platform.OS !== "ios" && Platform.OS !== "android") return;
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    return () => { ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP); };
  }, []);

  // StatusBar: hide/show
  useEffect(() => {
    StatusBar.setHidden(true);
    return () => { StatusBar.setHidden(false); };
  }, []);

  // Fetch PlaybackInfo once the item metadata is ready
  useEffect(() => {
    if (!pb.item) return;
    resumeApplied.current = false;
    retryCount.current = 0;
    setIsBuffering(true);
    setPaused(false);
    setBufferedTime(0);

    const resumeTicks = pb.item.UserData?.PlaybackPositionTicks;
    const resumeSeconds = resumeTicks && resumeTicks > 0 ? resumeTicks / TICKS_PER_SECOND : 0;
    // Store resume position so changeAudio/changeSubtitle preserves it
    pb.positionRef.current = resumeSeconds;
    // Don't set currentTime here — let handleProgress determine the real position

    pb.fetchPlaybackInfo({
      startTimeTicks: resumeTicks && resumeTicks > 0 ? resumeTicks : undefined,
    });
  }, [itemId, pb.item?.Id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset videoReady when stream URL changes (avoids selectedTextTrack crash)
  useEffect(() => { setVideoReady(false); }, [pb.streamUrl]);

  // Auto-apply language preferences
  usePlayerPreferences({
    item: pb.item,
    ancestors: pb.ancestors,
    streams: pb.streams,
    onAudioResolved: (idx) => pb.changeAudio(idx),
    onSubtitleResolved: (idx) => pb.changeSubtitle(idx),
  });

  // Audio/subtitle track lists for the modal
  const audioTracks = useMemo(() =>
    pb.streams.filter((s) => s.Type === "Audio").map((s) => ({ index: s.Index, label: formatTrackLabel(s) })),
    [pb.streams],
  );
  const subtitleTracks = useMemo(() =>
    pb.streams.filter((s) => s.Type === "Subtitle").map((s) => ({ index: s.Index, label: formatTrackLabel(s) })),
    [pb.streams],
  );

  const handleLoad = useCallback((_data: OnLoadData) => {
    setIsBuffering(false);
    setVideoReady(true);
    hasEverPlayed.current = true;

    // First load: resume from metadata; subsequent loads (track change): use current position
    const targetPosition = resumeApplied.current
      ? pb.positionRef.current
      : (pb.item?.UserData?.PlaybackPositionTicks ?? 0) / TICKS_PER_SECOND;
    resumeApplied.current = true;

    if (targetPosition > 0) {
      if (pb.isDirectPlay) {
        // Direct play: seek absolute (startPosition should already have positioned,
        // but seek as backup)
        videoRef.current?.seek(targetPosition);
      } else {
        // Transcode: HLS stream starts at streamOffset,
        // so seek to (target - streamOffset) within the stream
        const seekInStream = targetPosition - pb.streamOffset;
        if (seekInStream > 1) {
          videoRef.current?.seek(seekInStream);
        }
      }
    }

    pb.reporting.reportStart();
  }, [pb.item, pb.reporting, pb.isDirectPlay, pb.streamOffset, pb.positionRef]);

  const handleProgress = useCallback((data: OnProgressData) => {
    const raw = Math.max(0, data.currentTime);
    const pos = raw + pb.streamOffset;
    setCurrentTime(pos);
    setBufferedTime(data.playableDuration > 0 ? data.playableDuration + pb.streamOffset : 0);
    pb.positionRef.current = pos;
    pb.reporting.updatePosition(pos, paused);
  }, [paused, pb.reporting, pb.streamOffset, pb.positionRef]);

  const handleEnd = useCallback(() => {
    pb.reporting.reportStop();
    invalidateAndGoBack();
  }, [router, pb.reporting]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleError = useCallback((e: unknown) => {
    console.error("[Tentacle:Player] onError", e);
    if (retryCount.current < 1) {
      retryCount.current++;
      pb.retry();
    }
  }, [pb]);

  const handleSeek = useCallback((seconds: number) => {
    const dur = pb.jellyfinDuration || 0;
    const clamped = Math.max(0, dur > 0 ? Math.min(seconds, dur) : seconds);
    const offset = pb.streamOffset;
    videoRef.current?.seek(Math.max(0, clamped - offset));
    pb.reporting.reportSeek(clamped, paused);
  }, [pb.jellyfinDuration, pb.streamOffset, paused, pb.reporting]);

  // Invalidate home queries so watch state refreshes
  const invalidateAndGoBack = useCallback(() => {
    pb.reporting.reportStop();
    queryClient.invalidateQueries({ queryKey: ["item", itemId] });
    queryClient.invalidateQueries({ queryKey: ["resume-items"] });
    queryClient.invalidateQueries({ queryKey: ["latest-items"] });
    router.back();
  }, [router, pb.reporting, queryClient, itemId]);

  const handleNextEpisode = useCallback(() => {
    const next = pb.episodeNav.nextEpisode;
    if (!next) return;
    pb.reporting.reportStop();
    queryClient.invalidateQueries({ queryKey: ["resume-items"] });
    router.replace(`/watch/${next.Id}`);
  }, [pb.episodeNav.nextEpisode, pb.reporting, queryClient, router]);

  const handlePrevEpisode = useCallback(() => {
    const prev = pb.episodeNav.previousEpisode;
    if (!prev) return;
    pb.reporting.reportStop();
    queryClient.invalidateQueries({ queryKey: ["resume-items"] });
    router.replace(`/watch/${prev.Id}`);
  }, [pb.episodeNav.previousEpisode, pb.reporting, queryClient, router]);

  const toggleOverlay = useCallback(() => setOverlayVisible((v) => !v), []);

  // Cleanup on unmount — report stop + refresh resume lists
  // Note: don't invalidate ["item", itemId] here — it's already done in
  // invalidateAndGoBack, and double-invalidation resets MediaDetail animations
  useEffect(() => () => {
    pb.reporting.reportStop();
    queryClient.invalidateQueries({ queryKey: ["resume-items"] });
    queryClient.invalidateQueries({ queryKey: ["latest-items"] });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Error screen
  if (pb.error && !pb.isLoading) {
    return <PlayerErrorView message={t("playbackError")} onRetry={pb.retry} onBack={invalidateAndGoBack} />;
  }

  // Loading: no stream URL yet
  if (!pb.streamUrl) {
    return (
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        <PlayerLoadingView />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <Video
        ref={videoRef}
        source={{
          uri: pb.streamUrl,
          startPosition: pb.startPositionMs > 0 ? pb.startPositionMs : undefined,
          // Sideloaded VTT tracks — only for direct play (not HLS, crashes iOS AVPlayer)
          textTracks: pb.isDirectPlay && pb.textTracks.length > 0
            ? pb.textTracks as { title: string; language: ISO639_1; type: typeof pb.textTracks[number]["type"]; uri: string }[]
            : undefined,
        }}
        style={{ flex: 1 }}
        resizeMode="contain"
        paused={paused}
        selectedAudioTrack={
          pb.isDirectPlay && pb.audioTrackSelectedIndex >= 0
            ? { type: SelectedTrackType.INDEX, value: pb.audioTrackSelectedIndex }
            : undefined
        }
        selectedTextTrack={
          // Direct play: select sideloaded VTT track by index
          videoReady && pb.isDirectPlay && pb.textTrackSelectedIndex >= 0
            ? { type: SelectedTrackType.INDEX, value: pb.textTrackSelectedIndex }
            // Transcode with subtitle selected: show HLS-embedded subtitle (index 0 in manifest)
            : videoReady && !pb.isDirectPlay && pb.subtitleIndex >= 0
              ? { type: SelectedTrackType.INDEX, value: 0 }
              // No subtitle selected: disable
              : videoReady
                ? { type: SelectedTrackType.DISABLED }
                : undefined
        }
        onLoad={handleLoad}
        onProgress={handleProgress}
        onEnd={handleEnd}
        onError={handleError}
        onBuffer={({ isBuffering: b }) => setIsBuffering(b)}
        onReadyForDisplay={() => setIsBuffering(false)}
        progressUpdateInterval={250}
        preventsDisplaySleepDuringVideoPlayback
        allowsExternalPlayback={pb.textTracks.length === 0}
        enterPictureInPictureOnLeave
      />

      {isBuffering && !hasEverPlayed.current && <PlayerLoadingView />}

      <PlayerGestures
        currentTime={currentTime}
        overlayVisible={overlayVisible}
        onSeek={handleSeek}
        onToggleOverlay={toggleOverlay}
        onSwipeDown={invalidateAndGoBack}
      />

      <MobilePlayerOverlay
        title={pb.item?.Name ?? ""}
        currentTime={currentTime}
        duration={pb.jellyfinDuration || 0}
        bufferedTime={bufferedTime}
        paused={paused}
        audioTracks={audioTracks}
        subtitleTracks={subtitleTracks}
        selectedAudio={pb.audioIndex}
        selectedSubtitle={pb.subtitleIndex}
        qualityKey={pb.qualityKey}
        introSegment={pb.skipSegments.intro}
        creditsSegment={pb.skipSegments.credits}
        nextEpisode={pb.episodeNav.nextEpisode}
        previousEpisode={pb.episodeNav.previousEpisode}
        onPlayPause={() => setPaused((p) => !p)}
        onSeek={handleSeek}
        onBack={invalidateAndGoBack}
        onSelectAudio={pb.changeAudio}
        onSelectSubtitle={pb.changeSubtitle}
        onSelectQuality={pb.changeQuality}
        onNextEpisode={handleNextEpisode}
        onPreviousEpisode={handlePrevEpisode}
        visible={overlayVisible}
        onToggle={toggleOverlay}
      />
    </View>
  );
}
