import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { View, Text, Pressable } from "react-native";
import Video, { type OnProgressData, type OnLoadData, SelectedTrackType } from "react-native-video";
import {
  useJellyfinClient, useMediaItem, useItemAncestors, usePlaybackReporting,
  useResolveMediaTracks, useIntroSkipper,
} from "@tentacle-tv/api-client";
import { TICKS_PER_SECOND, ticksToSeconds } from "@tentacle-tv/shared";
import type { MediaStream as JfStream } from "@tentacle-tv/shared";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { TVPlayerOverlay } from "../components/TVPlayerOverlay";
import { TVTrackSelector } from "../components/TVTrackSelector";
import { useTVPlayerControls } from "../hooks/useTVPlayerControls";

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

  const videoRef = useRef<Video>(null);
  const [paused, setPaused] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioIndex, setAudioIndex] = useState(0);
  const [subtitleIndex, setSubtitleIndex] = useState(-1);
  const [showSettings, setShowSettings] = useState(false);
  const [startTicks, setStartTicks] = useState(0);
  const [forceTranscode, setForceTranscode] = useState(false);
  const positionRef = useRef(0);
  const prefsApplied = useRef(false);
  const [videoError, setVideoError] = useState<string | null>(null);

  const mediaSource = item?.MediaSources?.[0];
  const mediaSourceId = mediaSource?.Id ?? itemId;
  const streams: JfStream[] = mediaSource?.MediaStreams ?? [];

  const defaultAudio = useMemo(() =>
    streams.find((s) => s.Type === "Audio" && s.IsDefault)?.Index
    ?? streams.find((s) => s.Type === "Audio")?.Index ?? 0,
    [streams]
  );

  useEffect(() => {
    if (streams.length > 0) {
      setAudioIndex(defaultAudio);
      setSubtitleIndex(-1);
      setStartTicks(0);
      positionRef.current = 0;
      prefsApplied.current = false;
    }
  }, [itemId, streams.length > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedAudioStream = streams.find((s) => s.Type === "Audio" && s.Index === audioIndex);
  const selectedAudioCodec = selectedAudioStream?.Codec?.toLowerCase();
  const selectedAudioChannels = selectedAudioStream?.Channels ?? 2;
  const needsAudioTranscode = !!selectedAudioCodec && (
    /^(ac3|eac3|dts|truehd)$/i.test(selectedAudioCodec) || selectedAudioChannels > 6
  );

  const sourceVideoCodec = streams.find((s) => s.Type === "Video")?.Codec?.toLowerCase();
  const isDirectPlay = !forceTranscode && audioIndex === defaultAudio && !needsAudioTranscode;
  const isDirectStream = !isDirectPlay && !forceTranscode && needsAudioTranscode;

  const playSessionId = useMemo(() => {
    if (isDirectPlay) return undefined;
    return randomSessionId();
  }, [audioIndex, startTicks, isDirectPlay, forceTranscode]); // eslint-disable-line react-hooks/exhaustive-deps

  const streamUrl = useMemo(() => {
    if (!itemId) return null;
    if (forceTranscode) {
      return client.getStreamUrl(itemId, {
        mediaSourceId, audioIndex, directPlay: false, maxBitrate: 8_000_000,
        startTimeTicks: startTicks > 0 ? startTicks : undefined, playSessionId,
      });
    }
    return client.getStreamUrl(itemId, {
      mediaSourceId, audioIndex, directPlay: isDirectPlay,
      startTimeTicks: !isDirectPlay && startTicks > 0 ? startTicks : undefined,
      playSessionId, sourceVideoCodec,
    });
  }, [client, itemId, mediaSourceId, audioIndex, isDirectPlay, startTicks, playSessionId, sourceVideoCodec, forceTranscode]);

  const jellyfinDuration = useMemo(() => ticksToSeconds(item?.RunTimeTicks), [item]);

  const { reportStart, reportStop, updatePosition, reportSeek } = usePlaybackReporting({
    itemId, mediaSourceId, isDirectPlay, isDirectStream, playSessionId,
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
  useEffect(() => () => { reportStop(); }, [reportStop]);

  const handleSeek = useCallback((seconds: number) => {
    const dur = jellyfinDuration || 0;
    const clamped = Math.max(0, dur > 0 ? Math.min(seconds, dur) : seconds);
    videoRef.current?.seek(clamped);
    reportSeek(clamped, paused);
  }, [jellyfinDuration, paused, reportSeek]);

  const handlePlayPause = useCallback(() => setPaused((p) => !p), []);

  const controls = useTVPlayerControls({
    paused, jellyfinDuration: jellyfinDuration ?? 0,
    onSeek: handleSeek,
    onBack: () => { reportStop(); navigation.goBack(); },
    onPlayPause: handlePlayPause,
  });

  const handleLoad = useCallback((_data: OnLoadData) => {
    const resumeTicks = item?.UserData?.PlaybackPositionTicks;
    if (resumeTicks) videoRef.current?.seek(resumeTicks / TICKS_PER_SECOND);
    reportStart();
  }, [item, reportStart]);

  const handleProgress = useCallback((data: OnProgressData) => {
    setCurrentTime(data.currentTime);
    positionRef.current = data.currentTime;
    controls.currentTimeRef.current = data.currentTime;
    updatePosition(data.currentTime, paused);
  }, [paused, updatePosition, controls.currentTimeRef]);

  const handleEnd = useCallback(() => { reportStop(); navigation.goBack(); }, [navigation, reportStop]);

  const handleAudioChange = useCallback((newIndex: number) => {
    if (positionRef.current > 0) setStartTicks(Math.floor(positionRef.current * TICKS_PER_SECOND));
    setAudioIndex(newIndex);
  }, []);

  const handleError = useCallback((error: { error: { errorString?: string; errorCode?: string; errorStackTrace?: string } }) => {
    const msg = error?.error?.errorString || error?.error?.errorCode || "Unknown playback error";
    const trace = error?.error?.errorStackTrace ?? "";
    const isCodecError = msg.includes("DECODING_FAILED") || msg.includes("EXCEEDS_CAPABILITIES")
      || trace.includes("MediaCodecVideoRenderer") || trace.includes("MediaCodecVideoDecoderException");
    if (isCodecError && !forceTranscode) { setVideoError(null); setForceTranscode(true); return; }
    setVideoError(msg);
  }, [forceTranscode]);

  // Track lists for UI
  const audioTracks = useMemo(() =>
    streams.filter((s) => s.Type === "Audio").map((s) => ({ index: s.Index, label: formatTrackLabel(s) })), [streams]);
  const subtitleTracks = useMemo(() =>
    streams.filter((s) => s.Type === "Subtitle").map((s) => ({ index: s.Index, label: formatTrackLabel(s) })), [streams]);

  // Convert Jellyfin global index to player-relative index for react-native-video
  const audioStreams = useMemo(() => streams.filter((s) => s.Type === "Audio"), [streams]);
  const subtitleStreams = useMemo(() => streams.filter((s) => s.Type === "Subtitle"), [streams]);
  const audioRelativeIndex = useMemo(() => {
    const idx = audioStreams.findIndex((s) => s.Index === audioIndex);
    return idx >= 0 ? idx : 0;
  }, [audioStreams, audioIndex]);
  const subtitleRelativeIndex = useMemo(() => {
    if (subtitleIndex < 0) return -1;
    const idx = subtitleStreams.findIndex((s) => s.Index === subtitleIndex);
    return idx >= 0 ? idx : -1;
  }, [subtitleStreams, subtitleIndex]);

  const displayDuration = jellyfinDuration && jellyfinDuration > 0 ? jellyfinDuration : 0;
  if (!streamUrl) return <View style={{ flex: 1, backgroundColor: "#000" }} />;

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <Video
        ref={videoRef} source={{ uri: streamUrl }} style={{ flex: 1 }}
        resizeMode="contain" controls={false} paused={paused}
        onLoad={handleLoad} onProgress={handleProgress} onEnd={handleEnd} onError={handleError}
        selectedAudioTrack={{ type: SelectedTrackType.INDEX, value: audioRelativeIndex }}
        selectedTextTrack={subtitleRelativeIndex >= 0
          ? { type: SelectedTrackType.INDEX, value: subtitleRelativeIndex }
          : { type: SelectedTrackType.DISABLED }}
        progressUpdateInterval={250}
      />
      <Pressable
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        onPress={controls.showOverlay} onFocus={controls.showOverlay}
        // @ts-ignore react-native-tvos
        hasTVPreferredFocus={!controls.overlayVisible && !paused} accessible
      >
        <View style={{ flex: 1 }} />
      </Pressable>
      {videoError && (
        <View style={{
          position: "absolute", top: 60, left: 40, right: 40,
          backgroundColor: "rgba(239,68,68,0.9)", borderRadius: 8, padding: 16,
        }}>
          <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>Playback Error</Text>
          <Text style={{ color: "#fff", fontSize: 14, marginTop: 4 }}>{videoError}</Text>
        </View>
      )}
      <TVPlayerOverlay
        title={item?.Name ?? ""}
        currentTime={controls.scrubbing ? controls.scrubPosition : currentTime}
        duration={displayDuration} paused={paused} visible={controls.overlayVisible}
        speedLabel={controls.speedLabel}
        introSegment={skipSegments.intro} creditsSegment={skipSegments.credits}
        onPlayPause={() => { handlePlayPause(); controls.showOverlay(); }}
        onSkipBack={() => { controls.handleSkipBack(); controls.showOverlay(); }}
        onSkipForward={() => { controls.handleSkipForward(); controls.showOverlay(); }}
        onSkipIntro={skipSegments.intro ? () => handleSeek(skipSegments.intro!.end) : undefined}
        onSkipCredits={skipSegments.credits ? () => handleSeek(skipSegments.credits!.end) : undefined}
        onBack={() => { reportStop(); navigation.goBack(); }}
        onSettings={() => { setShowSettings((v) => !v); controls.showOverlay(); }}
      />
      {showSettings && (
        <TVTrackSelector
          audioTracks={audioTracks} subtitleTracks={subtitleTracks}
          selectedAudio={audioIndex} selectedSubtitle={subtitleIndex}
          onSelectAudio={handleAudioChange} onSelectSubtitle={setSubtitleIndex}
          onClose={() => setShowSettings(false)}
        />
      )}
    </View>
  );
}
