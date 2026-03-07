import { useState, useRef, useCallback, useMemo } from "react";
import { View, Text, PanResponder, Dimensions } from "react-native";

const { width: SCREEN_W } = Dimensions.get("window");
const BAR_H = 16;
const TRACK_H = 4;
const TRACK_H_ACTIVE = 6;
const THUMB_SIZE = 14;

interface Props {
  currentTime: number;
  duration: number;
  bufferedTime?: number;
  onSeek: (seconds: number) => void;
  onSeeking?: (seconds: number) => void;
}

function formatTime(s: number): string {
  if (!isFinite(s) || s < 0) s = 0;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function PlayerSeekBar({ currentTime, duration, bufferedTime, onSeek, onSeeking }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragProgress, setDragProgress] = useState(0);
  const barWidth = useRef(SCREEN_W - 32);

  const pctToTime = useCallback((pct: number) => {
    return Math.max(0, Math.min(duration, pct * duration));
  }, [duration]);

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => {
      setIsDragging(true);
      const pct = Math.max(0, Math.min(1, e.nativeEvent.locationX / barWidth.current));
      setDragProgress(pct);
      onSeeking?.(pctToTime(pct));
    },
    onPanResponderMove: (e) => {
      const pct = Math.max(0, Math.min(1, e.nativeEvent.locationX / barWidth.current));
      setDragProgress(pct);
      onSeeking?.(pctToTime(pct));
    },
    onPanResponderRelease: () => {
      setIsDragging(false);
      onSeek(pctToTime(dragProgress));
    },
    onPanResponderTerminate: () => {
      setIsDragging(false);
    },
  }), [duration, dragProgress, onSeek, onSeeking, pctToTime]);

  const progress = isDragging ? dragProgress : (duration > 0 ? currentTime / duration : 0);
  const buffered = duration > 0 && bufferedTime ? Math.min(1, bufferedTime / duration) : 0;
  const displayTime = isDragging ? pctToTime(dragProgress) : currentTime;
  const trackHeight = isDragging ? TRACK_H_ACTIVE : TRACK_H;

  return (
    <View style={{ paddingHorizontal: 16, paddingBottom: 36 }}>
      <View
        onLayout={(e) => { barWidth.current = e.nativeEvent.layout.width; }}
        style={{ height: BAR_H + 8, justifyContent: "center" }}
        {...panResponder.panHandlers}
      >
        {/* Track background */}
        <View style={{
          height: trackHeight, backgroundColor: "rgba(255,255,255,0.1)",
          borderRadius: trackHeight / 2, overflow: "hidden",
        }}>
          {/* Buffered portion */}
          {buffered > 0 && (
            <View style={{
              position: "absolute", top: 0, left: 0, bottom: 0,
              width: `${buffered * 100}%`,
              backgroundColor: "rgba(255,255,255,0.15)", borderRadius: trackHeight / 2,
            }} />
          )}
          {/* Played portion */}
          <View style={{
            height: "100%", width: `${progress * 100}%`,
            backgroundColor: "#8b5cf6", borderRadius: trackHeight / 2,
          }} />
        </View>

        {/* Thumb */}
        {isDragging && (
          <View style={{
            position: "absolute",
            left: progress * barWidth.current - THUMB_SIZE / 2,
            top: (BAR_H + 8) / 2 - THUMB_SIZE / 2,
            width: THUMB_SIZE, height: THUMB_SIZE, borderRadius: THUMB_SIZE / 2,
            backgroundColor: "#fff",
            shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.3, shadowRadius: 2,
          }} />
        )}
      </View>

      {/* Time labels */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 2 }}>
        <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, fontVariant: ["tabular-nums"] }}>
          {formatTime(displayTime)}
        </Text>
        <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, fontVariant: ["tabular-nums"] }}>
          {formatTime(duration)}
        </Text>
      </View>
    </View>
  );
}
