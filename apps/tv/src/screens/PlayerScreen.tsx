import { useState, useRef, useCallback, useEffect, useMemo, memo } from "react";
import { View, Text, Pressable, ActivityIndicator, AppState } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import {
  useJellyfinClient, useMediaItem, useItemAncestors, usePlaybackReporting,
  useResolveMediaTracks, useIntroSkipper,
} from "@tentacle-tv/api-client";
import { TICKS_PER_SECOND, ticksToSeconds } from "@tentacle-tv/shared";
import type { MediaStream as JfStream } from "@tentacle-tv/shared";
import { useTranslation } from "react-i18next";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { TVPlayerOverlay } from "../components/TVPlayerOverlay";
import { TVTrackSelector } from "../components/TVTrackSelector";
import { TVSkipSegmentButton } from "../components/TVSkipSegmentButton";
import { useTVPlayerControls } from "../hooks/useTVPlayerControls";
import { randomSessionId, formatTrackLabel } from "../utils/playerHelpers";
import { MPVPlayer, type MPVPlayerHandle, type MpvTrack } from "../components/player/MPVPlayer";
import { ExoPlayer } from "../components/player/ExoPlayer";
import { Colors } from "../theme/colors";

type Props = NativeStackScreenProps<RootStackParamList, "Player">;

interface MemoizedPlayerProps {
  useExoPlayer: boolean;
  exoRef: React.Ref<MPVPlayerHandle>;
  mpvRef: React.Ref<MPVPlayerHandle>;
  source: string;
  paused: boolean;
  onLoad: (duration: number) => void;
  onProgress: (currentTime: number, buffered: number) => void;
  onEnd: () => void;
  onError: (error: string) => void;
  onTracks: (tracks: MpvTrack[]) => void;
}

const MemoizedPlayer = memo(function MemoizedPlayer({
  useExoPlayer: isExo, exoRef, mpvRef, source, paused,
  onLoad, onProgress, onEnd, onError, onTracks,
}: MemoizedPlayerProps) {
  return isExo ? (
    <ExoPlayer
      ref={exoRef}
      source={source}
      paused={paused}
      progressInterval={1000}
      audioPassthrough
      style={{ flex: 1 }}
      onLoad={onLoad}
      onProgress={onProgress}
      onEnd={onEnd}
      onError={onError}
      onTracks={onTracks}
    />
  ) : (
    <MPVPlayer
      ref={mpvRef}
      source={source}
      paused={paused}
      progressInterval={1000}
      style={{ flex: 1 }}
      onLoad={onLoad}
      onProgress={onProgress}
      onEnd={onEnd}
      onError={onError}
      onTracks={onTracks}
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

  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(true);
  const lastProgressTime = useRef(Date.now());

  const mediaSource = item?.MediaSources?.[0];
  const mediaSourceId = mediaSource?.Id ?? itemId;
  const streams: JfStream[] = mediaSource?.MediaStreams ?? [];

  // Detect HDR/DV content — route to ExoPlayer for HDR passthrough
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
  }, [streams]);

  const handleSeek = useCallback((seconds: number) => {
    const dur = jellyfinDuration || 0;
    const clamped = Math.max(0, dur > 0 ? Math.min(seconds, dur) : seconds);
    // Update display immediately so overlay reflects the seek target
    displayTimeRef.current = clamped;
    setDisplayTime(clamped);
    lastDisplayUpdate.current = Date.now();
    if (isDirectPlay) {
      playerRef.current?.seek(clamped);
    } else {
      // For transcoded streams, the player position is relative to HLS start
      const offset = startTicks > 0 ? startTicks / TICKS_PER_SECOND : 0;
      playerRef.current?.seek(Math.max(0, clamped - offset));
    }
    reportSeek(clamped, paused);
  }, [jellyfinDuration, paused, reportSeek, isDirectPlay, startTicks]);

  const handlePlayPause = useCallback(() => setPaused((p) => !p), []);

  const controls = useTVPlayerControls({
    paused, jellyfinDuration: jellyfinDuration ?? 0,
    onSeek: handleSeek,
    onBack: () => {
      if (showSettingsRef.current) { setShowSettings(false); showSettingsRef.current = false; return; }
      invalidateAndGoBack();
    },
    onPlayPause: handlePlayPause,
    seekBarFocusedRef,
  });

  // Sync display time immediately when overlay appears
  useEffect(() => {
    if (controls.overlayVisible) {
      setDisplayTime(displayTimeRef.current);
      setBufferedTime(bufferedTimeRef.current);
      lastDisplayUpdate.current = Date.now();
    }
  }, [controls.overlayVisible]);

  const handleLoad = useCallback((duration: number) => {
    // Only seek for direct play — transcoded/HLS uses StartTimeTicks in URL
    if (isDirectPlay) {
      const resumeTicks = item?.UserData?.PlaybackPositionTicks;
      if (resumeTicks) playerRef.current?.seek(resumeTicks / TICKS_PER_SECOND);
    }
    setIsLoading(false);
    reportStart();
  }, [item, reportStart, isDirectPlay]);

  const handleProgress = useCallback((currentTime: number, buffered: number) => {
    const raw = Math.max(0, currentTime);
    const offset = !isDirectPlay && startTicks > 0 ? startTicks / TICKS_PER_SECOND : 0;
    const t = raw + offset;
    const bufferedAbs = Math.max(0, buffered) + offset;
    if (Math.floor(t) % 10 === 0 && Math.floor(t) !== Math.floor(positionRef.current)) {
      console.log("[Player] progress:", t.toFixed(1), "buffered:", bufferedAbs.toFixed(1), "raw buffered:", buffered.toFixed(1), "duration:", jellyfinDuration);
    }
    // Always update refs (no re-render)
    positionRef.current = t;
    controls.currentTimeRef.current = t;
    displayTimeRef.current = t;
    bufferedTimeRef.current = bufferedAbs;
    lastProgressTime.current = Date.now();
    setIsLoading(false);
    // Only update display state at ~1Hz to avoid excessive re-renders
    const now = Date.now();
    if (now - lastDisplayUpdate.current >= 1000) {
      lastDisplayUpdate.current = now;
      setDisplayTime(t);
      setBufferedTime(bufferedAbs);
    }
    updatePosition(t, pausedStateRef.current); // ref to avoid re-creating on pause/unpause
  }, [updatePosition, controls.currentTimeRef, isDirectPlay, startTicks]);

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

  const handleEnd = useCallback(() => { invalidateAndGoBack(); }, [invalidateAndGoBack]);

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

  const displayDuration = jellyfinDuration && jellyfinDuration > 0 ? jellyfinDuration : 0;
  if (!streamUrl) return <View style={{ flex: 1, backgroundColor: "#000" }} />;

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <MemoizedPlayer
        useExoPlayer={useExoPlayer}
        exoRef={exoRef}
        mpvRef={mpvRef}
        source={streamUrl}
        paused={paused}
        onLoad={handleLoad}
        onProgress={handleProgress}
        onEnd={handleEnd}
        onError={handleError}
        onTracks={handleTracks}
      />
      <Pressable
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        onPress={controls.showOverlay}
        // @ts-ignore react-native-tvos
        hasTVPreferredFocus={!controls.overlayVisible && !showSettings}
        accessible={!controls.overlayVisible && !showSettings}
        importantForAccessibility={controls.overlayVisible || showSettings ? "no-hide-descendants" : "auto"}
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
        duration={displayDuration} paused={paused} visible={controls.overlayVisible}
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
      />
      {/* Skip intro/credits — rendered outside overlay so always visible */}
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
      {showSettings && (
        <TVTrackSelector
          audioTracks={audioTracks} subtitleTracks={subtitleTracks}
          selectedAudio={audioIndex} selectedSubtitle={subtitleIndex}
          onSelectAudio={handleAudioChange} onSelectSubtitle={setSubtitleIndex}
          onClose={() => { setShowSettings(false); showSettingsRef.current = false; }}
        />
      )}
    </View>
  );
}
