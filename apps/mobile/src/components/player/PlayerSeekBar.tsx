import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { View, Text, PanResponder, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { MediaItem } from "@tentacle-tv/shared";
import { PLAYER, TABLET_MIN_WIDTH } from "@/theme";
import { useTrickplay } from "../../hooks/useTrickplay";
import { TrickplayPreview } from "./TrickplayPreview";

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
  /** Fired when the user starts/stops scrubbing — lets the parent overlay
      suspend its auto-hide timer while the finger is down. */
  onScrubStateChange?: (active: boolean) => void;
  /** When provided, enables trickplay preview above the bar while scrubbing. */
  item?: MediaItem;
  mediaSourceId?: string;
}

function formatTime(s: number): string {
  if (!isFinite(s) || s < 0) s = 0;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function PlayerSeekBar({
  currentTime, duration, bufferedTime, onSeek, onSeeking, onScrubStateChange,
  item, mediaSourceId,
}: Props) {
  const { width: winW, height: winH } = useWindowDimensions();
  const isTablet = Math.min(winW, winH) >= TABLET_MIN_WIDTH;
  const thumbSize = isTablet ? 20 : THUMB_SIZE;
  const [isDragging, setIsDragging] = useState(false);
  const [dragProgress, setDragProgress] = useState(0);
  const [touchX, setTouchX] = useState(0);
  const barWidth = useRef(winW - 32);
  const dragProgressRef = useRef(0);

  const trickplay = useTrickplay(item, mediaSourceId);

  const pctToTime = useCallback((pct: number) => {
    return Math.max(0, Math.min(duration, pct * duration));
  }, [duration]);

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => {
      setIsDragging(true);
      onScrubStateChange?.(true);
      const x = Math.max(0, Math.min(barWidth.current, e.nativeEvent.locationX));
      const pct = barWidth.current > 0 ? x / barWidth.current : 0;
      dragProgressRef.current = pct;
      setDragProgress(pct);
      setTouchX(x);
      onSeeking?.(pctToTime(pct));
    },
    onPanResponderMove: (e) => {
      const x = Math.max(0, Math.min(barWidth.current, e.nativeEvent.locationX));
      const pct = barWidth.current > 0 ? x / barWidth.current : 0;
      dragProgressRef.current = pct;
      setDragProgress(pct);
      setTouchX(x);
      onSeeking?.(pctToTime(pct));
    },
    onPanResponderRelease: () => {
      setIsDragging(false);
      onScrubStateChange?.(false);
      onSeek(pctToTime(dragProgressRef.current));
    },
    onPanResponderTerminate: () => {
      setIsDragging(false);
      onScrubStateChange?.(false);
    },
  }), [onSeek, onSeeking, onScrubStateChange, pctToTime]);

  const progress = isDragging ? dragProgress : (duration > 0 ? currentTime / duration : 0);
  const buffered = duration > 0 && bufferedTime ? Math.min(1, bufferedTime / duration) : 0;
  const displayTime = isDragging ? pctToTime(dragProgress) : currentTime;
  const trackHeight = (isDragging ? TRACK_H_ACTIVE : TRACK_H) * (isTablet ? 1.6 : 1);

  // Preview frame for the position currently under the finger.
  const previewSeconds = isDragging ? pctToTime(dragProgress) : 0;
  const currentFrame = useMemo(
    () => (isDragging ? trickplay.getFrameAt(previewSeconds * 1000) : null),
    [isDragging, previewSeconds, trickplay],
  );

  // Preload neighbor mosaics so adjacent positions don't flash.
  useEffect(() => {
    if (currentFrame) trickplay.preloadNeighbors(currentFrame.tileIndex);
  }, [currentFrame, trickplay]);

  return (
    <View style={{ paddingHorizontal: 16, paddingBottom: 36 }}>
      {/* Trickplay / timestamp preview lives in the bar's coordinate space so
          left + parentWidth math from the web port works unchanged. */}
      <View style={{ position: "relative" }}>
        <TrickplayPreview
          visible={isDragging}
          positionSeconds={previewSeconds}
          frame={currentFrame}
          info={trickplay.info}
          anchorX={touchX}
          parentWidth={barWidth.current}
        />

        <View
          onLayout={(e) => { barWidth.current = e.nativeEvent.layout.width; }}
          style={{ height: BAR_H + 8, justifyContent: "center" }}
          {...panResponder.panHandlers}
        >
          {/* Track background */}
          <View style={{
            height: trackHeight, backgroundColor: PLAYER.borderSubtle,
            borderRadius: trackHeight / 2, overflow: "hidden",
          }}>
            {/* Buffered portion */}
            {buffered > 0 && (
              <View style={{
                position: "absolute", top: 0, left: 0, bottom: 0,
                width: `${buffered * 100}%`,
                backgroundColor: PLAYER.border, borderRadius: trackHeight / 2,
              }} />
            )}
            {/* Played portion — le dégradé de marque du desktop
                (--progress-fill, violet → rose) avec son halo rose. Le halo
                est iOS-only par nature (elevation Android peindrait une ombre
                noire) — dégradation gracieuse assumée. */}
            <LinearGradient
              colors={[PLAYER.accent, PLAYER.accentRose]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                height: "100%", width: `${progress * 100}%`,
                borderRadius: trackHeight / 2,
                shadowColor: PLAYER.accentRose,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.55,
                shadowRadius: 6,
              }}
            />
          </View>

          {/* Thumb */}
          {isDragging && (
            <View style={{
              position: "absolute",
              left: progress * barWidth.current - thumbSize / 2,
              top: (BAR_H + 8) / 2 - thumbSize / 2,
              width: thumbSize, height: thumbSize, borderRadius: thumbSize / 2,
              backgroundColor: PLAYER.text,
              shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.3, shadowRadius: 2,
            }} />
          )}
        </View>
      </View>

      {/* Time labels */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 2 }}>
        <Text style={{ color: PLAYER.textTertiary, fontSize: 12, fontVariant: ["tabular-nums"] }}>
          {formatTime(displayTime)}
        </Text>
        <Text style={{ color: PLAYER.textTertiary, fontSize: 12, fontVariant: ["tabular-nums"] }}>
          {formatTime(duration)}
        </Text>
      </View>
    </View>
  );
}

