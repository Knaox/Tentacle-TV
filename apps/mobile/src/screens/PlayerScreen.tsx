import { useState, useRef, useCallback, useEffect } from "react";
import { View, StatusBar } from "react-native";
import Video, { type OnProgressData, type OnLoadData } from "react-native-video";
import { useRouter } from "expo-router";
import { useStream, useMediaItem, usePlaybackReporting } from "@tentacle/api-client";
import { MobilePlayerOverlay } from "../components/MobilePlayerOverlay";

interface Props {
  itemId: string;
}

export function PlayerScreen({ itemId }: Props) {
  const router = useRouter();
  const { data: item } = useMediaItem(itemId);
  const { streamUrl } = useStream(itemId);

  const videoRef = useRef<Video>(null);
  const [paused, setPaused] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [selectedAudio, setSelectedAudio] = useState(0);
  const [selectedSubtitle, setSelectedSubtitle] = useState(-1);

  const mediaSourceId = item?.MediaSources?.[0]?.Id ?? "";
  const { reportStart, reportStop, updatePosition } = usePlaybackReporting(itemId, mediaSourceId);

  useEffect(() => {
    return () => { reportStop(); };
  }, [reportStop]);

  const handleLoad = useCallback((data: OnLoadData) => {
    setDuration(data.duration);
    const startTicks = item?.UserData?.PlaybackPositionTicks;
    if (startTicks) {
      const startSeconds = startTicks / 10_000_000;
      videoRef.current?.seek(startSeconds);
    }
    reportStart();
  }, [item, reportStart]);

  const handleProgress = useCallback((data: OnProgressData) => {
    setCurrentTime(data.currentTime);
    updatePosition(data.currentTime, paused);
  }, [paused, updatePosition]);

  const handleEnd = useCallback(() => {
    reportStop();
    router.back();
  }, [router, reportStop]);

  const handleSeek = useCallback((seconds: number) => {
    const clamped = Math.max(0, Math.min(seconds, duration));
    videoRef.current?.seek(clamped);
    setCurrentTime(clamped);
  }, [duration]);

  const handlePlayPause = useCallback(() => {
    setPaused((p) => !p);
  }, []);

  // Audio/subtitle tracks
  const audioTracks = (item?.MediaSources?.[0]?.MediaStreams ?? [])
    .filter((s) => s.Type === "Audio")
    .map((s) => ({ index: s.Index, label: `${s.DisplayTitle || s.Language || "Audio"} (${s.Codec})` }));

  const subtitleTracks = (item?.MediaSources?.[0]?.MediaStreams ?? [])
    .filter((s) => s.Type === "Subtitle")
    .map((s) => ({ index: s.Index, label: s.DisplayTitle || s.Language || "Subtitle" }));

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
        selectedAudioTrack={{ type: "index", value: selectedAudio }}
        selectedTextTrack={selectedSubtitle >= 0 ? { type: "index", value: selectedSubtitle } : { type: "disabled" }}
        progressUpdateInterval={1000}
      />
      <MobilePlayerOverlay
        title={item?.Name ?? ""}
        currentTime={currentTime}
        duration={duration}
        paused={paused}
        audioTracks={audioTracks}
        subtitleTracks={subtitleTracks}
        selectedAudio={selectedAudio}
        selectedSubtitle={selectedSubtitle}
        onPlayPause={handlePlayPause}
        onSeek={handleSeek}
        onBack={() => { reportStop(); router.back(); }}
        onSelectAudio={setSelectedAudio}
        onSelectSubtitle={setSelectedSubtitle}
      />
    </View>
  );
}
