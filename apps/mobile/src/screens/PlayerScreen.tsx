import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { View, StatusBar } from "react-native";
import Video, { type OnProgressData, type OnLoadData } from "react-native-video";
import { useRouter } from "expo-router";
import {
  useJellyfinClient, useMediaItem, useItemAncestors, usePlaybackReporting,
  useResolveMediaTracks, useIntroSkipper,
} from "@tentacle/api-client";
import { TICKS_PER_SECOND, ticksToSeconds } from "@tentacle/shared";
import type { MediaStream as JfStream } from "@tentacle/shared";
import { MobilePlayerOverlay } from "../components/MobilePlayerOverlay";

interface Props { itemId: string }

const DBG = "[Tentacle:MobilePlayer]";

function formatTrackLabel(s: JfStream): string {
  const title = s.DisplayTitle || s.Title || s.Language || `Track ${s.Index}`;
  const codec = s.Codec?.toUpperCase();
  return codec && !title.toUpperCase().includes(codec) ? `${title} (${codec})` : title;
}

export function PlayerScreen({ itemId }: Props) {
  const router = useRouter();
  const client = useJellyfinClient();
  const { data: item } = useMediaItem(itemId);
  const { data: ancestors } = useItemAncestors(itemId);

  const videoRef = useRef<Video>(null);
  const [paused, setPaused] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioIndex, setAudioIndex] = useState(0);
  const [subtitleIndex, setSubtitleIndex] = useState(-1);
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

  // Detect unsupported audio codecs (native players can't decode these reliably)
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

  const isDirectPlay = audioIndex === defaultAudio && !needsAudioTranscode;
  // Remux = video copied, only audio transcoded (no explicit quality/bitrate limit)
  const isDirectStream = !isDirectPlay && needsAudioTranscode;

  // Unique ID per transcode session — lets Jellyfin's segment handler
  // find the correct transcode started by master.m3u8.
  const playSessionId = useMemo(() => {
    if (isDirectPlay) return undefined;
    return crypto.randomUUID();
  }, [audioIndex, startTicks, isDirectPlay]); // eslint-disable-line react-hooks/exhaustive-deps

  const streamUrl = useMemo(() => {
    if (!itemId) return null;
    return client.getStreamUrl(itemId, {
      mediaSourceId,
      audioIndex,
      directPlay: isDirectPlay,
      startTimeTicks: !isDirectPlay && startTicks > 0 ? startTicks : undefined,
      playSessionId,
      sourceVideoCodec,
    });
  }, [client, itemId, mediaSourceId, audioIndex, isDirectPlay, startTicks, playSessionId, sourceVideoCodec]);

  // Jellyfin duration — accurate, not from player
  const jellyfinDuration = useMemo(() => ticksToSeconds(item?.RunTimeTicks), [item]);

  const { reportStart, reportStop, updatePosition } = usePlaybackReporting({
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
    const ancestorIds = ancestors.map((a: any) => a.Id);
    const allCandidates = [...new Set([parentId, seriesId, ...ancestorIds].filter(Boolean))] as string[];
    if (allCandidates.length === 0) return;
    prefsApplied.current = true;
    console.debug(DBG, "resolving preferences", { allCandidates });
    resolveTracks.mutate({
      libraryId: allCandidates[0],
      libraryIds: allCandidates,
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
  }, [streams, item, ancestors]); // eslint-disable-line react-hooks/exhaustive-deps

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
    router.back();
  }, [router, reportStop]);

  // Unified seek — native player seek, no URL rebuild
  const handleSeek = useCallback((seconds: number) => {
    const dur = jellyfinDuration || 0;
    const clamped = Math.max(0, dur > 0 ? Math.min(seconds, dur) : seconds);
    console.debug(DBG, "seek", { clamped });
    videoRef.current?.seek(clamped);
    // Do NOT manually setCurrentTime — let onProgress update from the player
  }, [jellyfinDuration]);

  // Audio track change — saves position, triggers URL rebuild for non-default audio
  const handleAudioChange = useCallback((newIndex: number) => {
    console.debug(DBG, "audio change", { newIndex, position: positionRef.current });
    if (positionRef.current > 0) {
      setStartTicks(Math.floor(positionRef.current * TICKS_PER_SECOND));
    }
    setAudioIndex(newIndex);
  }, []);

  const handlePlayPause = useCallback(() => setPaused((p) => !p), []);

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
      <StatusBar hidden />
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
      <MobilePlayerOverlay
        title={item?.Name ?? ""}
        currentTime={currentTime}
        duration={displayDuration}
        paused={paused}
        audioTracks={audioTracks}
        subtitleTracks={subtitleTracks}
        selectedAudio={audioIndex}
        selectedSubtitle={subtitleIndex}
        introSegment={skipSegments.intro}
        creditsSegment={skipSegments.credits}
        onPlayPause={handlePlayPause}
        onSeek={handleSeek}
        onBack={() => { reportStop(); router.back(); }}
        onSelectAudio={handleAudioChange}
        onSelectSubtitle={setSubtitleIndex}
      />
    </View>
  );
}
