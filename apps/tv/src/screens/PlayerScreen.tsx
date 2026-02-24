import { useState, useRef, useCallback } from "react";
import { View } from "react-native";
import Video, { type OnProgressData, type OnLoadData } from "react-native-video";
import { useStream, useMediaItem, usePlaybackReporting } from "@tentacle/api-client";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { TVPlayerOverlay } from "../components/TVPlayerOverlay";
import { TVTrackSelector } from "../components/TVTrackSelector";
import { useTVRemote } from "../components/focus/useTVRemote";

type Props = NativeStackScreenProps<RootStackParamList, "Player">;

export function PlayerScreen({ route, navigation }: Props) {
  const { itemId } = route.params;
  const { data: item } = useMediaItem(itemId);
  const streamUrl = useStream(itemId);

  const videoRef = useRef<Video>(null);
  const [paused, setPaused] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedAudio, setSelectedAudio] = useState(0);
  const [selectedSubtitle, setSelectedSubtitle] = useState(-1);

  const mediaSourceId = item?.MediaSources?.[0]?.Id ?? "";
  const { reportStart, reportProgress, reportStop, updatePosition } = usePlaybackReporting(itemId, mediaSourceId);

  const handleLoad = useCallback((data: OnLoadData) => {
    setDuration(data.duration);
    // Resume from saved position
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
    navigation.goBack();
  }, [navigation, reportStop]);

  const handleSeek = useCallback((seconds: number) => {
    const clamped = Math.max(0, Math.min(seconds, duration));
    videoRef.current?.seek(clamped);
    setCurrentTime(clamped);
  }, [duration]);

  const handlePlayPause = useCallback(() => {
    setPaused((p) => !p);
  }, []);

  useTVRemote({
    onBack: () => { reportStop(); navigation.goBack(); },
    onPlayPause: handlePlayPause,
  });

  // Build audio/subtitle track lists
  const audioTracks = (item?.MediaSources?.[0]?.MediaStreams ?? [])
    .filter((s) => s.Type === "Audio")
    .map((s) => ({ index: s.Index, label: `${s.DisplayTitle || s.Language || "Audio"} (${s.Codec})` }));

  const subtitleTracks = (item?.MediaSources?.[0]?.MediaStreams ?? [])
    .filter((s) => s.Type === "Subtitle")
    .map((s) => ({ index: s.Index, label: s.DisplayTitle || s.Language || "Subtitle" }));

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
        selectedAudioTrack={{ type: "index", value: selectedAudio }}
        selectedTextTrack={selectedSubtitle >= 0 ? { type: "index", value: selectedSubtitle } : { type: "disabled" }}
        progressUpdateInterval={1000}
      />

      <TVPlayerOverlay
        title={item?.Name ?? ""}
        currentTime={currentTime}
        duration={duration}
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
          selectedAudio={selectedAudio}
          selectedSubtitle={selectedSubtitle}
          onSelectAudio={setSelectedAudio}
          onSelectSubtitle={setSelectedSubtitle}
          onClose={() => setShowSettings(false)}
        />
      )}
    </View>
  );
}
