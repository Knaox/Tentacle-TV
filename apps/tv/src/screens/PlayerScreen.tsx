import { useState, useRef, useCallback, useEffect, useMemo, type ElementRef } from "react";
import { View, TouchableOpacity, Dimensions, type ViewStyle } from "react-native";
import { useJellyfinClient, useMediaItem, useItemAncestors, usePlaybackReporting, useIntroSkipper, useEpisodeNavigation } from "@tentacle-tv/api-client";
import { TICKS_PER_SECOND, ticksToSeconds, extractSourceQuality } from "@tentacle-tv/shared";
import type { MediaStream as JfStream } from "@tentacle-tv/shared";
import { useQueryClient } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { useTVPlayerControls } from "../hooks/useTVPlayerControls";
import { useAutoPlay } from "../hooks/useAutoPlay";
import { formatTrackLabel } from "../utils/playerHelpers";
import type { MPVPlayerHandle } from "../components/player/MPVPlayer";
import { TVPlayerView } from "../components/player/TVPlayerView";
import { useTVPlaybackQuality } from "../hooks/useTVPlaybackQuality";
import { useTVPlaybackLifecycle } from "../hooks/useTVPlaybackLifecycle";
import { useTVMpvTracks } from "../hooks/useTVMpvTracks";
import { useTVTrackResolution } from "../hooks/useTVTrackResolution";
import { useTVPlayerEventHandlers } from "../hooks/useTVPlayerEventHandlers";
import { useTVStreamUrl } from "../hooks/useTVStreamUrl";

type Props = NativeStackScreenProps<RootStackParamList, "Player">;

const SCREEN = Dimensions.get("window");

export function PlayerScreen({ route, navigation }: Props) {
  const { itemId } = route.params;
  const client = useJellyfinClient();
  const { data: item } = useMediaItem(itemId);
  const { data: ancestors } = useItemAncestors(itemId);
  const queryClient = useQueryClient();

  const mpvRef = useRef<MPVPlayerHandle>(null);
  const exoRef = useRef<MPVPlayerHandle>(null);
  const backgroundRef = useRef<ElementRef<typeof TouchableOpacity>>(null);
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
  const resumeApplied = useRef(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const seekBarFocusedRef = useRef(false);
  const [isLoading, setIsLoading] = useState(true);
  const [videoAspect, setVideoAspect] = useState<number | null>(null);
  const lastProgressTime = useRef(Date.now());

  const quality = useTVPlaybackQuality();
  const sourceQuality = useMemo(() => extractSourceQuality(item), [item]);

  const mediaSource = item?.MediaSources?.[0];
  const mediaSourceId = mediaSource?.Id ?? itemId;
  const streams: JfStream[] = mediaSource?.MediaStreams ?? [];

  // ExoPlayer rend directement à la surface (pas de copie mediacodec lag-inducing comme MPV).
  // Forcé sur MPV uniquement quand un transcode est en cours.
  const useExoPlayer = !forceTranscode;
  const playerRef = useExoPlayer ? exoRef : mpvRef;

  const defaultAudio = useMemo(() =>
    streams.find((s) => s.Type === "Audio" && s.IsDefault)?.Index
    ?? streams.find((s) => s.Type === "Audio")?.Index ?? 0,
    [streams],
  );

  const resetPrefsAppliedRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (defaultAudio !== undefined) {
      setAudioIndex(defaultAudio);
      setSubtitleIndex(-1);
      setStartTicks(0);
      positionRef.current = 0;
      resetPrefsAppliedRef.current?.();
      quality.reset();
    }
  }, [itemId, defaultAudio]); // eslint-disable-line react-hooks/exhaustive-deps

  // Direct play tant qu'aucun transcode n'est imposé (codec, audio ou qualité user)
  const isDirectPlay = !forceTranscode && !quality.isTranscodingQuality;
  const isDirectStream = false;

  const { streamUrl, playSessionId } = useTVStreamUrl({
    itemId, mediaSourceId, streams, audioIndex, startTicks,
    forceTranscode, isTranscodingQuality: quality.isTranscodingQuality,
    maxBitrate: quality.maxBitrate, maxHeight: quality.maxHeight,
    isDirectPlay,
  });

  const jellyfinDuration = useMemo(() => ticksToSeconds(item?.RunTimeTicks), [item]);

  const { reportStart, reportStop, updatePosition, reportSeek } = usePlaybackReporting({
    itemId, mediaSourceId, isDirectPlay, isDirectStream, playSessionId,
    audioStreamIndex: audioIndex,
    subtitleStreamIndex: subtitleIndex === -1 ? null : subtitleIndex,
  });

  // Refs stables pour les listeners avec [] deps
  const pausedStateRef = useRef(paused);
  pausedStateRef.current = paused;
  const reportSeekRef = useRef(reportSeek);
  reportSeekRef.current = reportSeek;

  const trackRes = useTVTrackResolution({
    streams, item, ancestors,
    positionRef, setAudioIndex, setSubtitleIndex, setStartTicks,
  });
  resetPrefsAppliedRef.current = trackRes.resetPrefsApplied;

  const skipSegments = useIntroSkipper(itemId, item);

  const navigateToEpisode = useCallback((episodeId: string) => {
    reportStop();
    queryClient.invalidateQueries({ queryKey: ["item", itemId] });
    queryClient.invalidateQueries({ queryKey: ["resume-items"] });
    queryClient.invalidateQueries({ queryKey: ["next-up"] });
    navigation.replace("Player", { itemId: episodeId });
  }, [reportStop, queryClient, itemId, navigation]);

  const autoPlay = useAutoPlay(item, jellyfinDuration ?? 0, skipSegments.credits, navigateToEpisode);
  const { previousEpisode } = useEpisodeNavigation(item);

  // Resume position pour les streams transcodés / HLS
  useEffect(() => {
    if (resumeApplied.current || isDirectPlay) return;
    const resumeTicks = item?.UserData?.PlaybackPositionTicks;
    if (resumeTicks && resumeTicks > 0 && startTicks === 0) {
      resumeApplied.current = true;
      setStartTicks(resumeTicks);
    }
  }, [item, isDirectPlay, startTicks]);

  const lifecycle = useTVPlaybackLifecycle({
    itemId, seriesId: item?.SeriesId, navigation,
    reportStop, positionRef, pausedStateRef, reportSeekRef,
    onBackground: () => setPaused(true),
  });

  const mpvTracks = useTVMpvTracks({
    playerRef, streams, audioIndex, subtitleIndex,
    isDirectPlay, itemId, mediaSourceId,
  });

  const handleSeek = useCallback((seconds: number) => {
    const dur = jellyfinDuration || 0;
    const clamped = Math.max(0, dur > 0 ? Math.min(seconds, dur) : seconds);
    skipProgressCountRef.current = 1;
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
  }, [jellyfinDuration, paused, reportSeek, isDirectPlay, startTicks, playerRef]);

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
      lifecycle.invalidateAndGoBack();
    },
    onPlayPause: handlePlayPause,
    seekBarFocusedRef,
    settingsOpen: showSettings,
  });

  useEffect(() => {
    if (controls.overlayVisible) {
      setDisplayTime(displayTimeRef.current);
      setBufferedTime(bufferedTimeRef.current);
      lastDisplayUpdate.current = Date.now();
    }
  }, [controls.overlayVisible]);

  const events = useTVPlayerEventHandlers({
    item, playerRef, paused, isDirectPlay, startTicks,
    positionRef, pausedStateRef, displayTimeRef, bufferedTimeRef,
    lastDisplayUpdate, lastProgressTime, controlsCurrentTimeRef: controls.currentTimeRef,
    setDisplayTime, setBufferedTime, setIsLoading,
    reportStart, updatePosition,
    autoPlay, handleFinished: lifecycle.handleFinished,
  });
  const { handleLoad, handleProgress, handleEnd, skipProgressCountRef, checkTriggerRef } = events;

  const handleAudioChange = useCallback((newIndex: number) => {
    if (isDirectPlay) {
      const mpvId = mpvTracks.mpvTrackMap[newIndex];
      if (mpvId != null) playerRef.current?.setAudioTrack(mpvId);
      setAudioIndex(newIndex);
    } else {
      if (positionRef.current > 0) setStartTicks(Math.floor(positionRef.current * TICKS_PER_SECOND));
      setAudioIndex(newIndex);
    }
  }, [isDirectPlay, mpvTracks.mpvTrackMap, playerRef]);

  const handleQualityChange = useCallback((key: typeof quality.qualityKey) => {
    if (positionRef.current > 0) setStartTicks(Math.floor(positionRef.current * TICKS_PER_SECOND));
    quality.setQualityKey(key);
  }, [quality]);

  const handleError = useCallback((error: string) => {
    const isCodecError = error.includes("DECODING_FAILED") || error.includes("EXCEEDS_CAPABILITIES")
      || error.includes("codec") || error.includes("Could not open");
    if (isCodecError && !forceTranscode) { setVideoError(null); setForceTranscode(true); return; }
    setVideoError(error);
  }, [forceTranscode]);

  const audioTracksList = useMemo(() =>
    streams.filter((s) => s.Type === "Audio").map((s) => ({ index: s.Index, label: formatTrackLabel(s) })), [streams]);
  const subtitleTracksList = useMemo(() =>
    streams.filter((s) => s.Type === "Subtitle").map((s) => ({ index: s.Index, label: formatTrackLabel(s) })), [streams]);

  const handleVideoSize = useCallback((width: number, height: number, pixelRatio: number) => {
    if (width > 0 && height > 0) setVideoAspect((width / height) * pixelRatio);
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

  const handleCloseSettings = () => {
    setShowSettings(false);
    showSettingsRef.current = false;
    controls.showOverlay();
    setTimeout(() => {
      (backgroundRef.current as unknown as { setNativeProps?: (p: Record<string, unknown>) => void })?.setNativeProps?.({ hasTVPreferredFocus: true });
    }, 1);
  };

  return (
    <TVPlayerView
      item={item} streamUrl={streamUrl} paused={paused} isLoading={isLoading}
      videoError={videoError} displayTime={displayTime} bufferedTime={bufferedTime}
      displayDuration={displayDuration} showSettings={showSettings}
      autoPlayActive={autoPlayActive} hasPreviousEpisode={!!previousEpisode}
      useExoPlayer={useExoPlayer} exoRef={exoRef} mpvRef={mpvRef}
      backgroundRef={backgroundRef} playerStyle={playerStyle}
      audioTracksList={audioTracksList} subtitleTracksList={subtitleTracksList}
      audioIndex={audioIndex} subtitleIndex={subtitleIndex}
      qualityKey={quality.qualityKey} sourceQuality={sourceQuality}
      skipSegments={skipSegments} autoPlay={autoPlay} controls={controls}
      onLoad={handleLoad} onProgress={handleProgress} onEnd={handleEnd}
      onError={handleError} onTracks={mpvTracks.handleTracks} onVideoSize={handleVideoSize}
      onPlayPause={handlePlayPause} onSeek={handleSeek}
      onBack={lifecycle.invalidateAndGoBack}
      onToggleSettings={() => {
        setShowSettings((v) => { showSettingsRef.current = !v; return !v; });
        controls.showOverlay();
      }}
      onSelectAudio={handleAudioChange} onSelectSubtitle={setSubtitleIndex}
      onSelectQuality={handleQualityChange}
      onCloseSettings={handleCloseSettings}
      onPrevEpisode={handlePrevEpisode} onNextEpisode={handleNextEpisode}
      onSeekBarFocus={() => { seekBarFocusedRef.current = true; }}
      onSeekBarBlur={() => { seekBarFocusedRef.current = false; }}
    />
  );
}
