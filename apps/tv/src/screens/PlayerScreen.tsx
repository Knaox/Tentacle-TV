import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { View } from "react-native";
import Video, { type OnProgressData, type OnLoadData } from "react-native-video";
import {
  useJellyfinClient, useMediaItem, usePlaybackReporting,
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

const DBG = "[Tentacle:TVPlayer]";

function formatTrackLabel(s: JfStream): string {
  const title = s.DisplayTitle || s.Title || s.Language || `Track ${s.Index}`;
  const codec = s.Codec?.toUpperCase();
  return codec && !title.toUpperCase().includes(codec) ? `${title} (${codec})` : title;
}

export function PlayerScreen({ route, navigation }: Props) {
  const { itemId } = route.params;
  const client = useJellyfinClient();
  const { data: item } = useMediaItem(itemId);

  const videoRef = useRef<Video>(null);
  const [paused, setPaused] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioIndex, setAudioIndex] = useState(0);
  const [subtitleIndex, setSubtitleIndex] = useState(-1);
  const [showSettings, setShowSettings] = useState(false);
  const [startTicks, setStartTicks] = useState(0);
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

  // Build stream URL with mediaSourceId and selected audio track
  const isDirectPlay = audioIndex === defaultAudio;
  const streamUrl = useMemo(() => {
    if (!itemId) return null;
    return client.getStreamUrl(itemId, {
      mediaSourceId,
      audioIndex,
      directPlay: isDirectPlay,
      startTimeTicks: !isDirectPlay && startTicks > 0 ? startTicks : undefined,
    });
  }, [client, itemId, mediaSourceId, audioIndex, isDirectPlay, startTicks]);

  // Jellyfin duration — accurate, not from player
  const jellyfinDuration = useMemo(() => ticksToSeconds(item?.RunTimeTicks), [item]);

  const { reportStart, reportStop, updatePosition } = usePlaybackReporting(
    itemId, mediaSourceId, isDirectPlay
  );

  // Resolve preferred audio/subtitle tracks
  const resolveTracks = useResolveMediaTracks();
  useEffect(() => {
    if (prefsApplied.current || streams.length === 0 || !item) return;
    const parentId = (item as any).ParentId;
    const seriesId = (item as any).SeriesId;
    const libraryId = parentId || seriesId;
    if (!libraryId) return;
    prefsApplied.current = true;
    console.debug(DBG, "resolving preferences", { libraryId });
    resolveTracks.mutate({
      libraryId,
      libraryIds: [parentId, seriesId].filter(Boolean) as string[],
      audioTracks: streams.filter((s) => s.Type === "Audio")
        .map((s) => ({ index: s.Index, language: s.Language, isDefault: s.IsDefault })),
      subtitleTracks: streams.filter((s) => s.Type === "Subtitle")
        .map((s) => ({ index: s.Index, language: s.Language, isForced: s.IsForced, title: s.DisplayTitle })),
    }, {
      onSuccess: (result) => {
        console.debug(DBG, "preferences resolved", result);
        if (result.audioIndex != null) {
          if (positionRef.current > 0) {
            setStartTicks(Math.floor(positionRef.current * TICKS_PER_SECOND));
          }
          setAudioIndex(result.audioIndex);
        }
        if (result.subtitleIndex != null) setSubtitleIndex(result.subtitleIndex);
      },
    });
  }, [streams, item]); // eslint-disable-line react-hooks/exhaustive-deps

  // Intro skipper
  const skipSegments = useIntroSkipper(itemId, item);

  useEffect(() => () => { reportStop(); }, [reportStop]);

  const handleLoad = useCallback((_data: OnLoadData) => {
    console.debug(DBG, "loaded", { jellyfinDuration });
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
    console.debug(DBG, "seek", { clamped });
    videoRef.current?.seek(clamped);
    // Do NOT manually setCurrentTime — let onProgress update from the player
  }, [jellyfinDuration]);

  const handlePlayPause = useCallback(() => setPaused((p) => !p), []);

  // Audio track change — saves position, triggers URL rebuild for non-default audio
  const handleAudioChange = useCallback((newIndex: number) => {
    console.debug(DBG, "audio change", { newIndex, position: positionRef.current });
    if (positionRef.current > 0) {
      setStartTicks(Math.floor(positionRef.current * TICKS_PER_SECOND));
    }
    setAudioIndex(newIndex);
  }, []);

  useTVRemote({
    onBack: () => { reportStop(); navigation.goBack(); },
    onPlayPause: handlePlayPause,
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
        paused={paused}
        onLoad={handleLoad}
        onProgress={handleProgress}
        onEnd={handleEnd}
        selectedAudioTrack={{ type: "index", value: audioIndex }}
        selectedTextTrack={subtitleIndex >= 0 ? { type: "index", value: subtitleIndex } : { type: "disabled" }}
        progressUpdateInterval={250}
      />

      <TVPlayerOverlay
        title={item?.Name ?? ""}
        currentTime={currentTime}
        duration={displayDuration}
        paused={paused}
        onPlayPause={handlePlayPause}
        onSeek={handleSeek}
        onBack={() => { reportStop(); navigation.goBack(); }}
        onSettings={() => setShowSettings((s) => !s)}
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
