import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { View, StatusBar, ActivityIndicator, Text, Pressable, Platform } from "react-native";
import Video, { type OnProgressData, type OnLoadData } from "react-native-video";
import { useRouter } from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";
import {
  useJellyfinClient, useMediaItem, useItemAncestors, usePlaybackReporting,
  useResolveMediaTracks, useIntroSkipper,
} from "@tentacle-tv/api-client";
import { TICKS_PER_SECOND, ticksToSeconds } from "@tentacle-tv/shared";
import type { MediaStream as JfStream } from "@tentacle-tv/shared";
import { useTranslation } from "react-i18next";
import { MobilePlayerOverlay } from "../components/MobilePlayerOverlay";
import { randomUUID, formatTrackLabel } from "../lib/playerUtils";

interface Props { itemId: string }

const DBG = "[Tentacle:MobilePlayer]";

export function PlayerScreen({ itemId }: Props) {
  const { t } = useTranslation("player");
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
  const [isBuffering, setIsBuffering] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const positionRef = useRef(0);
  const prefsApplied = useRef(false);
  const resumeApplied = useRef(false);

  // ── Orientation: lock landscape on mount, restore portrait on unmount ──
  useEffect(() => {
    if (Platform.OS !== "ios" && Platform.OS !== "android") return;
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    return () => { ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP); };
  }, []);

  // ── StatusBar: hide on mount, show on unmount ──
  useEffect(() => {
    StatusBar.setHidden(true);
    return () => { StatusBar.setHidden(false); };
  }, []);

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
      setError(null);
      setIsBuffering(true);
      positionRef.current = 0;
      prefsApplied.current = false;
    }
  }, [itemId, streams.length > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  // Detect unsupported audio codecs
  const selectedAudioStream = streams.find(
    (s) => s.Type === "Audio" && s.Index === audioIndex
  );
  const selectedAudioCodec = selectedAudioStream?.Codec?.toLowerCase();
  const selectedAudioChannels = selectedAudioStream?.Channels ?? 2;
  const needsAudioTranscode = !!selectedAudioCodec && (
    /^(ac3|eac3|dts|truehd)$/i.test(selectedAudioCodec) || selectedAudioChannels > 6
  );

  const sourceVideoCodec = streams.find((s) => s.Type === "Video")?.Codec?.toLowerCase();

  const isDirectPlay = audioIndex === defaultAudio && !needsAudioTranscode;
  const isDirectStream = !isDirectPlay && needsAudioTranscode;

  const playSessionId = useMemo(() => {
    if (isDirectPlay) return undefined;
    return randomUUID();
  }, [audioIndex, startTicks, isDirectPlay]); // eslint-disable-line react-hooks/exhaustive-deps

  const streamUrl = useMemo(() => {
    if (!itemId) return null;
    return client.getStreamUrl(itemId, {
      mediaSourceId, audioIndex, directPlay: isDirectPlay,
      startTimeTicks: !isDirectPlay && startTicks > 0 ? startTicks : undefined,
      playSessionId, sourceVideoCodec,
    });
  }, [client, itemId, mediaSourceId, audioIndex, isDirectPlay, startTicks, playSessionId, sourceVideoCodec]);

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
    const ancestorIds = ancestors.map((a: any) => a.Id);
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

  useEffect(() => () => { reportStop(); }, [reportStop]);

  const handleLoad = useCallback((_data: OnLoadData) => {
    setIsBuffering(false);
    setError(null);
    if (isDirectPlay) {
      const resumeTicks = item?.UserData?.PlaybackPositionTicks;
      if (resumeTicks) videoRef.current?.seek(resumeTicks / TICKS_PER_SECOND);
    }
    reportStart();
  }, [item, reportStart, isDirectPlay]);

  const handleProgress = useCallback((data: OnProgressData) => {
    const raw = Math.max(0, data.currentTime);
    const offset = !isDirectPlay && startTicks > 0 ? startTicks / TICKS_PER_SECOND : 0;
    const pos = raw + offset;
    setCurrentTime(pos);
    positionRef.current = pos;
    updatePosition(pos, paused);
  }, [paused, updatePosition, isDirectPlay, startTicks]);

  const handleEnd = useCallback(() => {
    reportStop();
    router.back();
  }, [router, reportStop]);

  const handleError = useCallback((e: any) => {
    console.error(DBG, "playback error", e);
    setError(t("playbackError") ?? "Erreur de lecture");
    setIsBuffering(false);
  }, [t]);

  const handleBuffer = useCallback(({ isBuffering: buffering }: { isBuffering: boolean }) => {
    setIsBuffering(buffering);
  }, []);

  const handleReadyForDisplay = useCallback(() => {
    setIsBuffering(false);
  }, []);

  const handleRetry = useCallback(() => { setError(null); setIsBuffering(true); }, []);

  const handleSeek = useCallback((seconds: number) => {
    const dur = jellyfinDuration || 0;
    const clamped = Math.max(0, dur > 0 ? Math.min(seconds, dur) : seconds);
    const offset = !isDirectPlay && startTicks > 0 ? startTicks / TICKS_PER_SECOND : 0;
    videoRef.current?.seek(Math.max(0, clamped - offset));
    reportSeek(clamped, paused);
  }, [jellyfinDuration, paused, reportSeek, isDirectPlay, startTicks]);

  const handleAudioChange = useCallback((newIndex: number) => {
    if (positionRef.current > 0) setStartTicks(Math.floor(positionRef.current * TICKS_PER_SECOND));
    setAudioIndex(newIndex);
  }, []);

  const handlePlayPause = useCallback(() => setPaused((p) => !p), []);

  const audioTracks = useMemo(() =>
    streams.filter((s) => s.Type === "Audio").map((s) => ({ index: s.Index, label: formatTrackLabel(s) })),
    [streams]
  );
  const subtitleTracks = useMemo(() =>
    streams.filter((s) => s.Type === "Subtitle").map((s) => ({ index: s.Index, label: formatTrackLabel(s) })),
    [streams]
  );

  const displayDuration = jellyfinDuration > 0 ? jellyfinDuration : 0;

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

  if (!streamUrl) return <View style={{ flex: 1, backgroundColor: "#000" }} />;

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      {!error && (
        <Video
          ref={videoRef}
          source={{ uri: streamUrl }}
          style={{ flex: 1 }}
          resizeMode="contain"
          paused={paused}
          onLoad={handleLoad}
          onProgress={handleProgress}
          onEnd={handleEnd}
          onError={handleError}
          onBuffer={handleBuffer}
          onReadyForDisplay={handleReadyForDisplay}
          selectedAudioTrack={{ type: "index", value: audioRelativeIndex }}
          selectedTextTrack={subtitleRelativeIndex >= 0 ? { type: "index", value: subtitleRelativeIndex } : { type: "disabled" }}
          progressUpdateInterval={250}
        />
      )}

      {/* Loading spinner */}
      {isBuffering && !error && (
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color="#8b5cf6" />
        </View>
      )}

      {/* Error overlay */}
      {error && (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 32 }}>
          <Text style={{ color: "#fff", fontSize: 16, textAlign: "center", marginBottom: 16 }}>{error}</Text>
          <Pressable onPress={handleRetry} style={{ backgroundColor: "#8b5cf6", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 }}>
            <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>{t("retry") ?? "Réessayer"}</Text>
          </Pressable>
          <Pressable onPress={() => { reportStop(); router.back(); }} style={{ marginTop: 12 }}>
            <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 14 }}>{t("back") ?? "Retour"}</Text>
          </Pressable>
        </View>
      )}

      {!error && (
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
      )}
    </View>
  );
}
