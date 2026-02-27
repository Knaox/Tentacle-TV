import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { View, Text, Pressable } from "react-native";
import Video, { type OnProgressData, type OnLoadData, SelectedTrackType } from "react-native-video";
import {
  useJellyfinClient, useMediaItem, useItemAncestors, usePlaybackReporting,
  useResolveMediaTracks, useIntroSkipper,
} from "@tentacle/api-client";
import { TICKS_PER_SECOND, ticksToSeconds } from "@tentacle/shared";
import type { MediaStream as JfStream } from "@tentacle/shared";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { TVPlayerOverlay } from "../components/TVPlayerOverlay";
import { TVTrackSelector } from "../components/TVTrackSelector";
import { useTVRemote } from "../components/focus/useTVRemote";

type Props = NativeStackScreenProps<RootStackParamList, "Player">;

/** Hermes has no crypto.randomUUID — simple v4 fallback */
function randomSessionId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function formatTrackLabel(s: JfStream): string {
  const title = s.DisplayTitle || s.Title || s.Language || `Track ${s.Index}`;
  const codec = s.Codec?.toUpperCase();
  return codec && !title.toUpperCase().includes(codec) ? `${title} (${codec})` : title;
}

export function PlayerScreen({ route, navigation }: Props) {
  const { itemId } = route.params;
  const client = useJellyfinClient();
  const { data: item } = useMediaItem(itemId);
  const { data: ancestors } = useItemAncestors(itemId);

  const videoRef = useRef<any>(null);
  const [paused, setPaused] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioIndex, setAudioIndex] = useState(0);
  const [subtitleIndex, setSubtitleIndex] = useState(-1);
  const [showSettings, setShowSettings] = useState(false);
  const [startTicks, setStartTicks] = useState(0);
  const [forceTranscode, setForceTranscode] = useState(false);
  const positionRef = useRef(0);
  const prefsApplied = useRef(false);

  // Media source info — mediaSourceId is critical for episodes
  const mediaSource = item?.MediaSources?.[0];
  const mediaSourceId = mediaSource?.Id ?? itemId;
  const streams: JfStream[] = mediaSource?.MediaStreams ?? [];

  const defaultAudio = useMemo(() =>
    streams.find((s) => s.Type === "Audio" && s.IsDefault)?.Index
    ?? streams.find((s) => s.Type === "Audio")?.Index ?? 0,
    [streams]
  );

  // Reset state on episode change
  useEffect(() => {
    if (streams.length > 0) {
      setAudioIndex(defaultAudio);
      setSubtitleIndex(-1);
      setStartTicks(0);
      positionRef.current = 0;
      prefsApplied.current = false;
    }
  }, [itemId, streams.length > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  // Detect unsupported audio codecs (browsers/native players can't decode these)
  const selectedAudioStream = streams.find(
    (s) => s.Type === "Audio" && s.Index === audioIndex
  );
  const selectedAudioCodec = selectedAudioStream?.Codec?.toLowerCase();
  const selectedAudioChannels = selectedAudioStream?.Channels ?? 2;
  const needsAudioTranscode = !!selectedAudioCodec && (
    /^(ac3|eac3|dts|truehd)$/i.test(selectedAudioCodec) || selectedAudioChannels > 6
  );

  // Source video codec — needed for remux mode so Jellyfin does stream copy
  const sourceVideoCodec = streams.find((s) => s.Type === "Video")?.Codec?.toLowerCase();

  // When forceTranscode is true (codec error fallback), never direct play
  const isDirectPlay = !forceTranscode && audioIndex === defaultAudio && !needsAudioTranscode;
  // Remux = video copied, only audio transcoded (no explicit quality/bitrate limit)
  const isDirectStream = !isDirectPlay && !forceTranscode && needsAudioTranscode;

  // Unique ID per transcode session — lets Jellyfin's segment handler
  // find the correct transcode started by master.m3u8.
  const playSessionId = useMemo(() => {
    if (isDirectPlay) return undefined;
    return randomSessionId();
  }, [audioIndex, startTicks, isDirectPlay, forceTranscode]); // eslint-disable-line react-hooks/exhaustive-deps

  const streamUrl = useMemo(() => {
    if (!itemId) return null;
    // forceTranscode: use maxBitrate to trigger full HLS transcode to H.264
    if (forceTranscode) {
      return client.getStreamUrl(itemId, {
        mediaSourceId,
        audioIndex,
        directPlay: false,
        maxBitrate: 8_000_000,
        startTimeTicks: startTicks > 0 ? startTicks : undefined,
        playSessionId,
      });
    }
    return client.getStreamUrl(itemId, {
      mediaSourceId,
      audioIndex,
      directPlay: isDirectPlay,
      startTimeTicks: !isDirectPlay && startTicks > 0 ? startTicks : undefined,
      playSessionId,
      sourceVideoCodec,
    });
  }, [client, itemId, mediaSourceId, audioIndex, isDirectPlay, startTicks, playSessionId, sourceVideoCodec, forceTranscode]);

  // Jellyfin duration — accurate, not from player
  const jellyfinDuration = useMemo(() => ticksToSeconds(item?.RunTimeTicks), [item]);

  const { reportStart, reportStop, updatePosition, reportSeek } = usePlaybackReporting({
    itemId, mediaSourceId, isDirectPlay, isDirectStream,
    playSessionId,
    audioStreamIndex: audioIndex,
    subtitleStreamIndex: subtitleIndex === -1 ? null : subtitleIndex,
  });

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
      libraryId: allCandidates[0],
      libraryIds: allCandidates,
      audioTracks: streams.filter((s) => s.Type === "Audio")
        .map((s) => ({ index: s.Index, language: s.Language, isDefault: s.IsDefault })),
      subtitleTracks: streams.filter((s) => s.Type === "Subtitle")
        .map((s) => ({ index: s.Index, language: s.Language, isForced: s.IsForced, title: s.DisplayTitle })),
    }, {
      onSuccess: (result) => {
        if (result.audioIndex != null) {
          if (positionRef.current > 0) {
            setStartTicks(Math.floor(positionRef.current * TICKS_PER_SECOND));
          }
          setAudioIndex(result.audioIndex);
        }
        if (result.subtitleIndex != null) setSubtitleIndex(result.subtitleIndex);
      },
    });
  }, [streams, item, ancestors]); // eslint-disable-line react-hooks/exhaustive-deps

  // Intro skipper
  const skipSegments = useIntroSkipper(itemId, item);

  useEffect(() => () => { reportStop(); }, [reportStop]);

  const handleLoad = useCallback((_data: OnLoadData) => {
    const resumeTicks = item?.UserData?.PlaybackPositionTicks;
    if (resumeTicks) {
      videoRef.current?.seek(resumeTicks / TICKS_PER_SECOND);
    }
    reportStart();
  }, [item, reportStart, jellyfinDuration]);

  // Position comes ONLY from player events, never manual setState on seek
  const handleProgress = useCallback((data: OnProgressData) => {
    setCurrentTime(data.currentTime);
    positionRef.current = data.currentTime;
    updatePosition(data.currentTime, paused);
  }, [paused, updatePosition]);

  const handleEnd = useCallback(() => {
    reportStop();
    navigation.goBack();
  }, [navigation, reportStop]);

  // Unified seek — native player seek, no manual setState
  const handleSeek = useCallback((seconds: number) => {
    const dur = jellyfinDuration || 0;
    const clamped = Math.max(0, dur > 0 ? Math.min(seconds, dur) : seconds);
    videoRef.current?.seek(clamped);
    reportSeek(clamped, paused);
    // Do NOT manually setCurrentTime — let onProgress update from the player
  }, [jellyfinDuration, paused, reportSeek]);

  const handlePlayPause = useCallback(() => setPaused((p) => !p), []);

  // Audio track change — saves position, triggers URL rebuild for non-default audio
  const handleAudioChange = useCallback((newIndex: number) => {
    if (positionRef.current > 0) {
      setStartTicks(Math.floor(positionRef.current * TICKS_PER_SECOND));
    }
    setAudioIndex(newIndex);
  }, []);

  // --- Overlay visibility (managed here, not inside overlay) ---
  const [overlayVisible, setOverlayVisible] = useState(true);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);

  const showOverlay = useCallback(() => {
    setOverlayVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (!paused) {
      hideTimerRef.current = setTimeout(() => setOverlayVisible(false), 5000);
    }
  }, [paused]);

  // Re-schedule auto-hide when paused changes
  useEffect(() => {
    showOverlay();
    return () => { if (hideTimerRef.current) clearTimeout(hideTimerRef.current); };
  }, [paused, showOverlay]);

  const handleError = useCallback((error: { error: { errorString?: string; errorCode?: string; errorStackTrace?: string } }) => {
    const msg = error?.error?.errorString || error?.error?.errorCode || "Unknown playback error";
    const trace = error?.error?.errorStackTrace ?? "";
    console.error("[Player] Video error:", msg);

    // Auto-fallback to server-side transcoding on codec errors
    const isCodecError = msg.includes("DECODING_FAILED")
      || msg.includes("EXCEEDS_CAPABILITIES")
      || trace.includes("MediaCodecVideoRenderer")
      || trace.includes("MediaCodecVideoDecoderException");

    if (isCodecError && !forceTranscode) {
      console.error("[Player] Codec unsupported, retrying with server-side transcoding...");
      setVideoError(null);
      setForceTranscode(true);
      return;
    }
    setVideoError(msg);
  }, [forceTranscode]);

  useTVRemote({
    onBack: () => { reportStop(); navigation.goBack(); },
    onPlayPause: () => { handlePlayPause(); showOverlay(); },
    onAnyPress: showOverlay,
  });

  const audioTracks = useMemo(() =>
    streams.filter((s) => s.Type === "Audio")
      .map((s) => ({ index: s.Index, label: formatTrackLabel(s) })),
    [streams]
  );
  const subtitleTracks = useMemo(() =>
    streams.filter((s) => s.Type === "Subtitle")
      .map((s) => ({ index: s.Index, label: formatTrackLabel(s) })),
    [streams]
  );

  const displayDuration = jellyfinDuration > 0 ? jellyfinDuration : 0;

  if (!streamUrl) return <View style={{ flex: 1, backgroundColor: "#000" }} />;

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <Video
        ref={videoRef}
        source={{ uri: streamUrl }}
        style={{ flex: 1 }}
        resizeMode="contain"
        controls={false}
        paused={paused}
        onLoad={handleLoad}
        onProgress={handleProgress}
        onEnd={handleEnd}
        onError={handleError}
        selectedAudioTrack={{ type: SelectedTrackType.INDEX, value: audioIndex }}
        selectedTextTrack={subtitleIndex >= 0 ? { type: SelectedTrackType.INDEX, value: subtitleIndex } : { type: SelectedTrackType.DISABLED }}
        progressUpdateInterval={250}
      />

      {/* Tap/select anywhere to show overlay — receives D-pad focus when overlay hidden */}
      <Pressable
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        onPress={showOverlay}
        onFocus={showOverlay}
        // @ts-ignore react-native-tvos
        hasTVPreferredFocus={!overlayVisible && !paused}
        accessible
      >
        <View style={{ flex: 1 }} />
      </Pressable>

      {/* Error display */}
      {videoError && (
        <View style={{
          position: "absolute", top: 60, left: 40, right: 40,
          backgroundColor: "rgba(239,68,68,0.9)", borderRadius: 8,
          padding: 16,
        }}>
          <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>Playback Error</Text>
          <Text style={{ color: "#fff", fontSize: 14, marginTop: 4 }}>{videoError}</Text>
          <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, marginTop: 8 }}>
            URL: {streamUrl?.substring(0, 80)}...
          </Text>
        </View>
      )}

      <TVPlayerOverlay
        title={item?.Name ?? ""}
        currentTime={currentTime}
        duration={displayDuration}
        paused={paused}
        visible={overlayVisible}
        onPlayPause={() => { handlePlayPause(); showOverlay(); }}
        onSeek={(s) => { handleSeek(s); showOverlay(); }}
        onBack={() => { reportStop(); navigation.goBack(); }}
        onSettings={() => { setShowSettings((v) => !v); showOverlay(); }}
      />

      {showSettings && (
        <TVTrackSelector
          audioTracks={audioTracks}
          subtitleTracks={subtitleTracks}
          selectedAudio={audioIndex}
          selectedSubtitle={subtitleIndex}
          onSelectAudio={handleAudioChange}
          onSelectSubtitle={setSubtitleIndex}
          onClose={() => setShowSettings(false)}
        />
      )}
    </View>
  );
}
