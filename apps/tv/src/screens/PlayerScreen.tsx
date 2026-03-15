import { useState, useRef, useCallback, useEffect, useMemo, memo } from "react";
import { View, Text, Pressable, ActivityIndicator, AppState, Dimensions, type ViewStyle } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import {
  useJellyfinClient, useMediaItem, useItemAncestors, usePlaybackReporting,
  useResolveMediaTracks, useIntroSkipper, useEpisodeNavigation,
} from "@tentacle-tv/api-client";
import { TICKS_PER_SECOND, ticksToSeconds } from "@tentacle-tv/shared";
import type { MediaStream as JfStream } from "@tentacle-tv/shared";
import { useTranslation } from "react-i18next";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { TVPlayerOverlay } from "../components/TVPlayerOverlay";
import { TVTrackSelector } from "../components/TVTrackSelector";
import { TVSkipSegmentButton } from "../components/TVSkipSegmentButton";
import { TVAutoPlayOverlay } from "../components/TVAutoPlayOverlay";
import { useTVPlayerControls } from "../hooks/useTVPlayerControls";
import { useAutoPlay } from "../hooks/useAutoPlay";
import { randomSessionId, formatTrackLabel } from "../utils/playerHelpers";
import { MPVPlayer, type MPVPlayerHandle, type MpvTrack } from "../components/player/MPVPlayer";
import { ExoPlayer } from "../components/player/ExoPlayer";
import { Colors } from "../theme/colors";

type Props = NativeStackScreenProps<RootStackParamList, "Player">;

const SCREEN = Dimensions.get("window");

interface MemoizedPlayerProps {
  useExoPlayer: boolean;
  exoRef: React.Ref<MPVPlayerHandle>;
  mpvRef: React.Ref<MPVPlayerHandle>;
  source: string;
  paused: boolean;
  playerStyle: ViewStyle;
  onLoad: (duration: number) => void;
  onProgress: (currentTime: number, buffered: number) => void;
  onEnd: () => void;
  onError: (error: string) => void;
  onTracks: (tracks: MpvTrack[]) => void;
  onVideoSize: (width: number, height: number, pixelRatio: number) => void;
}

const MemoizedPlayer = memo(function MemoizedPlayer({
  useExoPlayer: isExo, exoRef, mpvRef, source, paused, playerStyle,
  onLoad, onProgress, onEnd, onError, onTracks, onVideoSize,
}: MemoizedPlayerProps) {
  return isExo ? (
    <ExoPlayer
      ref={exoRef}
      source={source}
      paused={paused}
      progressInterval={1000}
      audioPassthrough
      style={playerStyle}
      onLoad={onLoad}
      onProgress={onProgress}
      onEnd={onEnd}
      onError={onError}
      onTracks={onTracks}
      onVideoSize={onVideoSize}
    />
  ) : (
    <MPVPlayer
      ref={mpvRef}
      source={source}
      paused={paused}
      progressInterval={1000}
      style={playerStyle}
      onLoad={onLoad}
      onProgress={onProgress}
      onEnd={onEnd}
      onError={onError}
      onTracks={onTracks}
      onVideoSize={onVideoSize}
    />
  );
});

export function PlayerScreen({ route, navigation }: Props) {
  const { itemId } = route.params;
  const { t } = useTranslation("player");
  const client = useJellyfinClient();
  const { data: item } = useMediaItem(itemId);
  const { data: ancestors } = useItemAncestors(itemId);

  const mpvRef = useRef<MPVPlayerHandle>(null);
  const exoRef = useRef<MPVPlayerHandle>(null);
  const [paused, setPaused] = useState(false);
  const [displayTime, setDisplayTime] = useState(0);
  const [bufferedTime, setBufferedTime] = useState(0);
  const displayTimeRef = useRef(0);
  const bufferedTimeRef = useRef(0);
  const lastDisplayUpdate = useRef(0);
  const [audioIndex, setAudioIndex] = useState(0);
  const [subtitleIndex, setSubtitleIndex] = useState(-1);
  const [showSettings, setShowSettings] = useState(false);
  const showSettingsRef = useRef(false);
  const [startTicks, setStartTicks] = useState(0);
  const [forceTranscode, setForceTranscode] = useState(false);
  const positionRef = useRef(0);
  const prefsApplied = useRef(false);
  const resumeApplied = useRef(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [mpvTrackMap, setMpvTrackMap] = useState<Record<number, number>>({});
  const seekBarFocusedRef = useRef(false);
  const externalSubsLoaded = useRef(false);
  const [videoAspect, setVideoAspect] = useState<number | null>(null);

  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(true);
  const lastProgressTime = useRef(Date.now());

  const mediaSource = item?.MediaSources?.[0];
  const mediaSourceId = mediaSource?.Id ?? itemId;
  const streams: JfStream[] = mediaSource?.MediaStreams ?? [];

  // Route HDR/DV content to ExoPlayer for HDR passthrough
  const videoStream = streams.find((s) => s.Type === "Video");
  const isHDR = videoStream?.VideoRangeType != null
    && videoStream.VideoRangeType !== "SDR";
  const useExoPlayer = isHDR && !forceTranscode;
  // Unified ref — points to whichever player is active
  const playerRef = useExoPlayer ? exoRef : mpvRef;

  const defaultAudio = useMemo(() =>
    streams.find((s) => s.Type === "Audio" && s.IsDefault)?.Index
    ?? streams.find((s) => s.Type === "Audio")?.Index ?? 0,
    [streams]
  );

  useEffect(() => {
    if (defaultAudio !== undefined) {
      setAudioIndex(defaultAudio);
      setSubtitleIndex(-1);
      setStartTicks(0);
      positionRef.current = 0;
      prefsApplied.current = false;
      externalSubsLoaded.current = false;
    }
  }, [itemId, defaultAudio]);

  // MPV handles all codecs natively — direct play unless forced transcode
  const isDirectPlay = !forceTranscode;
  const isDirectStream = false;

  const playSessionId = useMemo(() => {
    if (isDirectPlay) return undefined;
    return randomSessionId();
  }, [audioIndex, startTicks, isDirectPlay, forceTranscode]); // eslint-disable-line react-hooks/exhaustive-deps

  const sourceVideoCodec = streams.find((s) => s.Type === "Video")?.Codec?.toLowerCase();

  const streamUrl = useMemo(() => {
    if (!itemId) return null;
    if (forceTranscode) {
      return client.getStreamUrl(itemId, {
        mediaSourceId, audioIndex, directPlay: false, maxBitrate: 8_000_000,
        startTimeTicks: startTicks > 0 ? startTicks : undefined, playSessionId,
      });
    }
    return client.getStreamUrl(itemId, {
      mediaSourceId, directPlay: true,
      playSessionId, sourceVideoCodec,
    });
  }, [client, itemId, mediaSourceId, startTicks, playSessionId, sourceVideoCodec, forceTranscode]);

  const jellyfinDuration = useMemo(() => ticksToSeconds(item?.RunTimeTicks), [item]);

  const { reportStart, reportStop, updatePosition, reportSeek } = usePlaybackReporting({
    itemId, mediaSourceId, isDirectPlay, isDirectStream, playSessionId,
    audioStreamIndex: audioIndex,
    subtitleStreamIndex: subtitleIndex === -1 ? null : subtitleIndex,
  });

  // Refs for stable access in AppState listener ([] deps)
  const pausedStateRef = useRef(paused);
  pausedStateRef.current = paused;
  const reportSeekRef = useRef(reportSeek);
  reportSeekRef.current = reportSeek;

  // Resolve preferred audio/subtitle tracks
  const resolveTracks = useResolveMediaTracks();
  useEffect(() => {
    if (prefsApplied.current || streams.length === 0 || !item || !ancestors) return;
    const parentId = item.ParentId;
    const seriesId = item.SeriesId;
    const ancestorIds = ancestors.map((a: { Id: string }) => a.Id);
    const allCandidates = [...new Set([parentId, seriesId, ...ancestorIds].filter(Boolean))] as string[];
    if (allCandidates.length === 0) return;
    prefsApplied.current = true;
    resolveTracks.mutate({
      libraryId: allCandidates[0], libraryIds: allCandidates,
      audioTracks: streams.filter((s) => s.Type === "Audio")
        .map((s) => ({ index: s.Index, language: s.Language, isDefault: s.IsDefault })),
      subtitleTracks: streams.filter((s) => s.Type === "Subtitle")
        .map((s) => ({ index: s.Index, language: s.Language, isForced: s.IsForced, title: s.DisplayTitle })),
    }, {
      onSuccess: (result) => {
        if (result.audioIndex != null) {
          if (positionRef.current > 0) setStartTicks(Math.floor(positionRef.current * TICKS_PER_SECOND));
          setAudioIndex(result.audioIndex);
        }
        if (result.subtitleIndex != null) setSubtitleIndex(result.subtitleIndex);
      },
    });
  }, [streams, item, ancestors]); // eslint-disable-line react-hooks/exhaustive-deps

  const skipSegments = useIntroSkipper(itemId, item);

  // Auto-play next episode (credits detection + countdown)
  const navigateToEpisode = useCallback((episodeId: string) => {
    reportStop();
    queryClient.invalidateQueries({ queryKey: ["item", itemId] });
    queryClient.invalidateQueries({ queryKey: ["resume-items"] });
    queryClient.invalidateQueries({ queryKey: ["next-up"] });
    navigation.replace("Player", { itemId: episodeId });
  }, [reportStop, queryClient, itemId, navigation]);

  const autoPlay = useAutoPlay(
    item, jellyfinDuration ?? 0,
    skipSegments.credits, navigateToEpisode,
  );

  const { previousEpisode } = useEpisodeNavigation(item);

  // For transcoded/HLS streams, include resume position in the URL
  useEffect(() => {
    if (resumeApplied.current || isDirectPlay) return;
    const resumeTicks = item?.UserData?.PlaybackPositionTicks;
    if (resumeTicks && resumeTicks > 0 && startTicks === 0) {
      resumeApplied.current = true;
      setStartTicks(resumeTicks);
    }
  }, [item, isDirectPlay, startTicks]);

  const invalidateAndGoBack = useCallback(async () => {
    await reportStop();
    queryClient.invalidateQueries({ queryKey: ["item", itemId] });
    queryClient.invalidateQueries({ queryKey: ["resume-items"] });
    queryClient.invalidateQueries({ queryKey: ["latest-items"] });
    queryClient.invalidateQueries({ queryKey: ["next-up"] });
    navigation.goBack();
  }, [reportStop, queryClient, itemId, navigation]);

  /** When episode finishes, navigate to series detail instead of just going back */
  const handleFinished = useCallback(async () => {
    await reportStop();
    queryClient.invalidateQueries({ queryKey: ["item", itemId] });
    queryClient.invalidateQueries({ queryKey: ["resume-items"] });
    queryClient.invalidateQueries({ queryKey: ["latest-items"] });
    queryClient.invalidateQueries({ queryKey: ["next-up"] });
    const seriesId = item?.SeriesId;
    if (seriesId) {
      // Go to series detail to see seasons & episodes
      navigation.replace("MediaDetail", { itemId: seriesId });
    } else {
      navigation.goBack();
    }
  }, [reportStop, queryClient, itemId, item?.SeriesId, navigation]);

  useEffect(() => () => {
    reportStop();
    queryClient.invalidateQueries({ queryKey: ["item", itemId] });
    queryClient.invalidateQueries({ queryKey: ["resume-items"] });
    queryClient.invalidateQueries({ queryKey: ["latest-items"] });
    queryClient.invalidateQueries({ queryKey: ["next-up"] });
  }, [reportStop]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pause video + save progress when app goes to background (Home button)
  // Use reportSeek (Progress report) instead of reportStop to keep startedRef alive,
  // so Back after returning still sends a proper Stop with the saved position.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "background" || state === "inactive") {
        setPaused(true);
        reportSeekRef.current(positionRef.current, true);
      } else if (state === "active") {
        // Restart reporting after returning from background
        reportSeekRef.current(positionRef.current, pausedStateRef.current);
      }
    });
    return () => sub.remove();
  }, []); // stable — refs avoid dep on reportSeek/paused

  // Build MPV track map when tracks arrive (Jellyfin index → MPV track ID)
  // Also load external subtitle files that MPV doesn't find in the container.
  const handleTracks = useCallback((tracks: MpvTrack[]) => {
    const audioTracks = tracks.filter((t) => t.type === "audio");
    const subTracks = tracks.filter((t) => t.type === "sub");
    const jellyfinAudio = streams.filter((s) => s.Type === "Audio");
    const jellyfinSubs = streams.filter((s) => s.Type === "Subtitle");
    const map: Record<number, number> = {};
    jellyfinAudio.forEach((s, i) => {
      if (i < audioTracks.length) map[s.Index] = audioTracks[i].id;
    });
    jellyfinSubs.forEach((s, i) => {
      if (i < subTracks.length) map[s.Index] = subTracks[i].id;
    });
    setMpvTrackMap(map);

    // Load subtitle tracks that MPV didn't find in the container (external subs).
    // Uses count comparison instead of IsExternal (field may be absent from API).
    // Uses direct Jellyfin URL when available (MPV makes native HTTP requests
    // without auth headers — proxy would strip api_key and reject).
    if (!externalSubsLoaded.current && isDirectPlay && itemId && mediaSourceId) {
      const missingCount = jellyfinSubs.length - subTracks.length;
      if (missingCount > 0) {
        externalSubsLoaded.current = true;
        const ds = client.getDirectStreaming?.();
        for (let i = subTracks.length; i < jellyfinSubs.length; i++) {
          const sub = jellyfinSubs[i];
          let url: string;
          if (ds?.enabled && ds.mediaBaseUrl && ds.jellyfinToken) {
            url = `${ds.mediaBaseUrl}/Videos/${itemId}/${mediaSourceId}/Subtitles/${sub.Index}/Stream.vtt?api_key=${encodeURIComponent(ds.jellyfinToken)}`;
          } else {
            url = client.getSubtitleUrl(itemId, mediaSourceId, sub.Index);
          }
          playerRef.current?.addSubtitleTrack(url);
        }
      }
    }
  }, [streams, isDirectPlay, itemId, mediaSourceId, client]);

  // Count of stale progress callbacks to skip after a seek
  const skipProgressCountRef = useRef(0);

  const handleSeek = useCallback((seconds: number) => {
    const dur = jellyfinDuration || 0;
    const clamped = Math.max(0, dur > 0 ? Math.min(seconds, dur) : seconds);
    skipProgressCountRef.current = 1; // skip next 1 stale callback
    displayTimeRef.current = clamped;
    positionRef.current = clamped;
    setDisplayTime(clamped);
    lastDisplayUpdate.current = Date.now();
    lastProgressTime.current = Date.now();
    if (isDirectPlay) {
      playerRef.current?.seek(clamped);
    } else {
      const offset = startTicks > 0 ? startTicks / TICKS_PER_SECOND : 0;
      playerRef.current?.seek(Math.max(0, clamped - offset));
    }
    reportSeek(clamped, paused);
    checkTriggerRef.current(clamped);
  }, [jellyfinDuration, paused, reportSeek, isDirectPlay, startTicks]);

  // Restart episode (single click) or previous episode (double click < 500ms)
  const prevClickTimeRef = useRef(0);
  const handlePrevEpisode = useCallback(() => {
    const now = Date.now();
    if (now - prevClickTimeRef.current < 500 && previousEpisode) {
      navigateToEpisode(previousEpisode.Id);
    } else {
      handleSeek(0);
    }
    prevClickTimeRef.current = now;
  }, [previousEpisode, navigateToEpisode, handleSeek]);

  const handleNextEpisode = useCallback(() => {
    if (autoPlay.nextEpisode) navigateToEpisode(autoPlay.nextEpisode.Id);
  }, [autoPlay.nextEpisode, navigateToEpisode]);

  const handlePlayPause = useCallback(() => setPaused((p) => !p), []);

  const controls = useTVPlayerControls({
    paused, jellyfinDuration: jellyfinDuration ?? 0,
    onSeek: handleSeek,
    onBack: () => {
      if (autoPlay.countdown !== null) { autoPlay.cancelAutoPlay(); return; }
      if (showSettingsRef.current) { setShowSettings(false); showSettingsRef.current = false; return; }
      invalidateAndGoBack();
    },
    onPlayPause: handlePlayPause,
    seekBarFocusedRef,
    settingsOpen: showSettings,
  });

  // Sync display time immediately when overlay appears
  useEffect(() => {
    if (controls.overlayVisible) {
      setDisplayTime(displayTimeRef.current);
      setBufferedTime(bufferedTimeRef.current);
      lastDisplayUpdate.current = Date.now();
    }
  }, [controls.overlayVisible]);

  // Stable refs for native player callbacks — native side keeps the initial
  // JS callback, so these must have [] deps to avoid stale closures in release builds.
  const checkTriggerRef = useRef(autoPlay.checkTrigger);
  checkTriggerRef.current = autoPlay.checkTrigger;
  const reportStartRef = useRef(reportStart);
  reportStartRef.current = reportStart;
  const isDirectPlayRef = useRef(isDirectPlay);
  isDirectPlayRef.current = isDirectPlay;
  const startTicksRef = useRef(startTicks);
  startTicksRef.current = startTicks;
  const updatePositionRef = useRef(updatePosition);
  updatePositionRef.current = updatePosition;

  const handleLoad = useCallback((duration: number) => {
    if (isDirectPlayRef.current) {
      const resumeTicks = item?.UserData?.PlaybackPositionTicks;
      if (resumeTicks) playerRef.current?.seek(resumeTicks / TICKS_PER_SECOND);
    }
    setIsLoading(false);
    reportStartRef.current();
  }, [item]);

  const handleProgress = useCallback((currentTime: number, buffered: number) => {
    const raw = Math.max(0, currentTime);
    const offset = !isDirectPlayRef.current && startTicksRef.current > 0
      ? startTicksRef.current / TICKS_PER_SECOND : 0;
    const t = raw + offset;
    const bufferedAbs = Math.max(0, buffered) + offset;

    // After a seek, skip 1 stale progress callback (native reports old position).
    // Keep lastProgressTime updated to prevent false rebuffering detection.
    if (skipProgressCountRef.current > 0) {
      skipProgressCountRef.current--;
      bufferedTimeRef.current = bufferedAbs;
      lastProgressTime.current = Date.now();
      setIsLoading(false);
      return;
    }

    positionRef.current = t;
    controls.currentTimeRef.current = t;
    displayTimeRef.current = t;
    bufferedTimeRef.current = bufferedAbs;
    lastProgressTime.current = Date.now();
    setIsLoading(false);
    const now = Date.now();
    if (now - lastDisplayUpdate.current >= 1000) {
      lastDisplayUpdate.current = now;
      setDisplayTime(t);
      setBufferedTime(bufferedAbs);
    }
    updatePositionRef.current(t, pausedStateRef.current);
    // Check auto-play trigger on every progress tick (not dependent on re-renders)
    checkTriggerRef.current(t);
  }, [controls.currentTimeRef]);

  // Detect rebuffering: no progress callback for >2s while playing
  useEffect(() => {
    if (paused) return;
    const interval = setInterval(() => {
      if (!paused && Date.now() - lastProgressTime.current > 2000) {
        setIsLoading(true);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [paused]);

  // Refs for stable handleEnd — native player keeps the initial JS callback,
  // so deps must not change or the native side calls a stale closure.
  const autoPlayRef = useRef(autoPlay);
  autoPlayRef.current = autoPlay;
  const invalidateAndGoBackRef = useRef(invalidateAndGoBack);
  invalidateAndGoBackRef.current = invalidateAndGoBack;
  const handleFinishedRef = useRef(handleFinished);
  handleFinishedRef.current = handleFinished;

  const handleEnd = useCallback(() => {
    const ap = autoPlayRef.current;
    if (ap.nextEpisode && ap.countdown === null) {
      ap.startAutoPlay();
    } else if (ap.countdown !== null) {
      // Countdown already running — let it finish
    } else {
      // No next episode OR user dismissed — go to series detail or back
      handleFinishedRef.current();
    }
  }, []);

  const handleAudioChange = useCallback((newIndex: number) => {
    if (isDirectPlay) {
      // MPV: switch track directly, no URL change needed
      const mpvId = mpvTrackMap[newIndex];
      if (mpvId != null) playerRef.current?.setAudioTrack(mpvId);
      setAudioIndex(newIndex);
    } else {
      // Transcode fallback: change URL (server-side track selection)
      if (positionRef.current > 0) setStartTicks(Math.floor(positionRef.current * TICKS_PER_SECOND));
      setAudioIndex(newIndex);
    }
  }, [isDirectPlay, mpvTrackMap]);

  // Apply subtitle track via MPV when in direct play
  useEffect(() => {
    if (!isDirectPlay) return;
    if (subtitleIndex < 0) {
      playerRef.current?.setSubtitleTrack(0); // disable
    } else {
      const mpvId = mpvTrackMap[subtitleIndex];
      if (mpvId != null) playerRef.current?.setSubtitleTrack(mpvId);
    }
  }, [subtitleIndex, isDirectPlay, mpvTrackMap]);

  // Apply audio track via MPV when in direct play
  useEffect(() => {
    if (!isDirectPlay) return;
    const mpvId = mpvTrackMap[audioIndex];
    if (mpvId != null) playerRef.current?.setAudioTrack(mpvId);
  }, [audioIndex, isDirectPlay, mpvTrackMap]);

  const handleError = useCallback((error: string) => {
    const isCodecError = error.includes("DECODING_FAILED") || error.includes("EXCEEDS_CAPABILITIES")
      || error.includes("codec") || error.includes("Could not open");
    if (isCodecError && !forceTranscode) { setVideoError(null); setForceTranscode(true); return; }
    setVideoError(error);
  }, [forceTranscode]);

  // Track lists for UI
  const audioTracks = useMemo(() =>
    streams.filter((s) => s.Type === "Audio").map((s) => ({ index: s.Index, label: formatTrackLabel(s) })), [streams]);
  const subtitleTracks = useMemo(() =>
    streams.filter((s) => s.Type === "Subtitle").map((s) => ({ index: s.Index, label: formatTrackLabel(s) })), [streams]);

  const handleVideoSize = useCallback((width: number, height: number, pixelRatio: number) => {
    if (width > 0 && height > 0) {
      setVideoAspect((width / height) * pixelRatio);
    }
  }, []);

  const playerStyle = useMemo<ViewStyle>(() => {
    if (!videoAspect) return { width: SCREEN.width, height: SCREEN.height };
    const screenAspect = SCREEN.width / SCREEN.height;
    if (videoAspect > screenAspect) {
      return { width: SCREEN.width, height: Math.round(SCREEN.width / videoAspect) };
    }
    return { width: Math.round(SCREEN.height * videoAspect), height: SCREEN.height };
  }, [videoAspect]);

  const displayDuration = jellyfinDuration && jellyfinDuration > 0 ? jellyfinDuration : 0;
  const autoPlayActive = autoPlay.countdown !== null;
  if (!streamUrl) return <View style={{ flex: 1, backgroundColor: "#000" }} />;

  return (
    <View style={{ flex: 1, backgroundColor: "#000", justifyContent: "center", alignItems: "center" }}>
      <MemoizedPlayer
        useExoPlayer={useExoPlayer}
        exoRef={exoRef}
        mpvRef={mpvRef}
        source={streamUrl}
        paused={paused}
        playerStyle={playerStyle}
        onLoad={handleLoad}
        onProgress={handleProgress}
        onEnd={handleEnd}
        onError={handleError}
        onTracks={handleTracks}
        onVideoSize={handleVideoSize}
      />
      <Pressable
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        onPress={controls.showOverlay}
        // @ts-ignore react-native-tvos
        hasTVPreferredFocus={!showSettings && !autoPlayActive}
        accessible={!showSettings && !autoPlayActive}
        importantForAccessibility={showSettings || autoPlayActive ? "no-hide-descendants" : "auto"}
      >
        <View style={{ flex: 1 }} />
      </Pressable>
      {isLoading && (
        <View style={{
          position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
          justifyContent: "center", alignItems: "center",
          backgroundColor: "rgba(0,0,0,0.3)",
          zIndex: 50, elevation: 50,
        }} pointerEvents="none">
          <ActivityIndicator size="large" color={Colors.accentPurple} />
        </View>
      )}
      {videoError && (
        <View style={{
          position: "absolute", top: 60, left: 40, right: 40,
          backgroundColor: "rgba(239,68,68,0.9)", borderRadius: 8, padding: 16,
        }}>
          <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>{t("playbackError")}</Text>
          <Text style={{ color: "#fff", fontSize: 14, marginTop: 4 }}>{videoError}</Text>
        </View>
      )}
      <TVPlayerOverlay
        title={item?.Name ?? ""}
        currentTime={controls.scrubbing ? controls.scrubPosition : displayTime}
        bufferedTime={bufferedTime}
        duration={displayDuration} paused={paused}
        visible={controls.overlayVisible && !autoPlayActive}
        speedLabel={controls.speedLabel} seekActive={controls.seekActive}
        onPlayPause={() => { handlePlayPause(); controls.showOverlay(); }}
        onSkipBack={() => { controls.handleSkipBack(); controls.showOverlay(); }}
        onSkipForward={() => { controls.handleSkipForward(); controls.showOverlay(); }}
        onBack={invalidateAndGoBack}
        onSettings={() => {
          setShowSettings((v) => { showSettingsRef.current = !v; return !v; });
          controls.showOverlay();
        }}
        onSeekBarFocus={() => { seekBarFocusedRef.current = true; }}
        onSeekBarBlur={() => { seekBarFocusedRef.current = false; }}
        onNextEpisode={handleNextEpisode}
        onPrevEpisode={handlePrevEpisode}
        hasNextEpisode={!!autoPlay.nextEpisode}
        hasPreviousEpisode={!!previousEpisode}
      />
      {/* Skip intro/credits — hidden during auto-play overlay */}
      {!autoPlayActive && (
        <>
          <TVSkipSegmentButton
            type="intro"
            segment={skipSegments.intro}
            currentTime={displayTime}
            onSkip={() => handleSeek(skipSegments.intro!.end)}
            overlayVisible={controls.overlayVisible}
            showSettings={showSettings}
          />
          <TVSkipSegmentButton
            type="credits"
            segment={skipSegments.credits}
            currentTime={displayTime}
            onSkip={() => handleSeek(skipSegments.credits!.end)}
            overlayVisible={controls.overlayVisible}
            showSettings={showSettings}
          />
        </>
      )}
      {showSettings && (
        <TVTrackSelector
          audioTracks={audioTracks} subtitleTracks={subtitleTracks}
          selectedAudio={audioIndex} selectedSubtitle={subtitleIndex}
          onSelectAudio={handleAudioChange} onSelectSubtitle={setSubtitleIndex}
          onClose={() => { setShowSettings(false); showSettingsRef.current = false; controls.showOverlay(); }}
          onInteraction={controls.showOverlay}
        />
      )}
      {autoPlayActive && (
        <TVAutoPlayOverlay
          countdown={autoPlay.countdown!}
          episodeTitle={autoPlay.nextEpisodeTitle}
          episodeDescription={autoPlay.nextEpisodeDescription}
          episodeImageUrl={autoPlay.nextEpisodeImageUrl}
          onPlayNow={autoPlay.navigateToNextEpisode}
          onDismiss={autoPlay.cancelAutoPlay}
        />
      )}
    </View>
  );
}
