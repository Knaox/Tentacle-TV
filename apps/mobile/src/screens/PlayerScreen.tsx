import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { View, StatusBar, Platform } from "react-native";
import Video, { type OnProgressData, type OnLoadData, type VideoRef, SelectedTrackType } from "react-native-video";
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
import { SubtitleOverlay } from "../components/player/SubtitleOverlay";

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
  const retryingRef = useRef(false);
  const hasEverPlayed = useRef(false);
  const [playerError, setPlayerError] = useState<string | null>(null);

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
  // Also clear retryingRef + playerError so the new stream can report errors
  useEffect(() => {
    setVideoReady(false);
    retryingRef.current = false;
    setPlayerError(null);
  }, [pb.streamUrl]);

  // Android loading timeout — if onLoad hasn't fired after 20s, show error
  useEffect(() => {
    if (!pb.streamUrl || videoReady) return;
    const timer = setTimeout(() => {
      if (!videoReady && !playerError && !retryingRef.current) {
        console.log("[Tentacle:Player] loading timeout (20s) — URL:", pb.streamUrl?.slice(0, 200));
        if (retryCount.current < 1) {
          retryCount.current++;
          retryingRef.current = true;
          pb.retry();
        } else {
          setPlayerError(t("playbackError"));
        }
      }
    }, 20_000);
    return () => clearTimeout(timer);
  }, [pb.streamUrl, videoReady]); // eslint-disable-line react-hooks/exhaustive-deps

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

    pb.reporting.reportStart(targetPosition);
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
    // Guard against duplicate onError from ExoPlayer or race with retryingRef
    if (retryingRef.current) return;
    const errorDetail = e && typeof e === "object" ? JSON.stringify(e) : String(e);
    if (retryCount.current < 1) {
      // First error = expected on emulators / unsupported codecs → auto-retry with transcode
      console.log("[Tentacle:Player] onError — retrying with transcode fallback", errorDetail);
      retryCount.current++;
      retryingRef.current = true;
      pb.retry();
    } else {
      // All retries exhausted — show error screen
      console.error("[Tentacle:Player] onError — all retries exhausted", errorDetail);
      setPlayerError(t("playbackError"));
    }
  }, [pb, t]);

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

  // Error screen — from playback hook (HTTP error) or player (codec/stream error)
  if ((pb.error || playerError) && !pb.isLoading) {
    return (
      <PlayerErrorView
        message={playerError ?? t("playbackError")}
        onRetry={() => {
          setPlayerError(null);
          retryCount.current = 0;
          retryingRef.current = false;
          pb.retry();
        }}
        onBack={invalidateAndGoBack}
      />
    );
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
          // Auth headers — Android only (iOS uses cookies / query string token)
          ...(Platform.OS === "android" && Object.keys(pb.headers).length > 0 ? { headers: pb.headers } : {}),
          startPosition: pb.startPositionMs > 0 ? pb.startPositionMs : undefined,
          // Sideloaded VTT tracks — iOS direct play only (Android uses custom SubtitleOverlay)
          textTracks: pb.isDirectPlay && pb.textTracks.length > 0 && Platform.OS === "ios"
            ? pb.textTracks as any
            : undefined,
          // Help ExoPlayer identify HLS streams (Jellyfin URLs may lack .m3u8 extension)
          ...(Platform.OS === "android" && !pb.isDirectPlay ? { type: "m3u8" } : {}),
        }}
        style={{ flex: 1 }}
        resizeMode="contain"
        paused={paused}
        // Android ExoPlayer buffer config — larger buffer for smoother playback
        {...(Platform.OS === "android" ? {
          bufferConfig: {
            minBufferMs: 15000,
            maxBufferMs: 50000,
            bufferForPlaybackMs: 2500,
            bufferForPlaybackAfterRebufferMs: 5000,
          },
        } : {})}
        selectedAudioTrack={
          pb.isDirectPlay && pb.audioTrackSelectedIndex >= 0
            ? { type: SelectedTrackType.INDEX, value: pb.audioTrackSelectedIndex }
            : undefined
        }
        selectedTextTrack={
          // iOS direct play: select sideloaded VTT track by index
          videoReady && pb.isDirectPlay && pb.textTrackSelectedIndex >= 0 && Platform.OS === "ios"
            ? { type: SelectedTrackType.INDEX, value: pb.textTrackSelectedIndex }
            // Android + transcode: subtitles handled by custom SubtitleOverlay — disable native tracks
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
        // PiP only on iOS — Android needs manifest config
        {...(Platform.OS === "ios" ? { enterPictureInPictureOnLeave: true } : {})}
      />

      <SubtitleOverlay vttUrl={pb.subtitleVttUrl} currentTime={currentTime} headers={pb.headers} />

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
