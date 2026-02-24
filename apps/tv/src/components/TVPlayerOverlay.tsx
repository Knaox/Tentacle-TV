import { useState, useEffect, useRef, useCallback } from "react";
import { View, Text, Animated } from "react-native";
import { Focusable } from "./focus/Focusable";

interface TVPlayerOverlayProps {
  title: string;
  currentTime: number;
  duration: number;
  paused: boolean;
  onPlayPause: () => void;
  onSeek: (seconds: number) => void;
  onBack: () => void;
  onSettings: () => void;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export function TVPlayerOverlay({
  title, currentTime, duration, paused,
  onPlayPause, onSeek, onBack, onSettings,
}: TVPlayerOverlayProps) {
  const [visible, setVisible] = useState(true);
  const opacity = useRef(new Animated.Value(1)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();

  const show = useCallback(() => {
    setVisible(true);
    Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    clearTimeout(hideTimer.current);
    if (!paused) {
      hideTimer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => setVisible(false));
      }, 5000);
    }
  }, [paused, opacity]);

  useEffect(() => {
    show();
    return () => clearTimeout(hideTimer.current);
  }, [paused, show]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  if (!visible && !paused) return null;

  return (
    <Animated.View style={{
      position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: "rgba(0,0,0,0.5)", opacity, justifyContent: "space-between",
    }}>
      {/* Top bar */}
      <View style={{ flexDirection: "row", alignItems: "center", padding: 32 }}>
        <Focusable onPress={onBack}>
          <View style={{ padding: 8 }}>
            <Text style={{ color: "#fff", fontSize: 24 }}>←</Text>
          </View>
        </Focusable>
        <Text numberOfLines={1} style={{ color: "#fff", fontSize: 20, fontWeight: "600", marginLeft: 16, flex: 1 }}>
          {title}
        </Text>
      </View>

      {/* Bottom controls */}
      <View style={{ padding: 32, paddingBottom: 48 }}>
        {/* Progress bar */}
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 20 }}>
          <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 14, width: 65 }}>{formatTime(currentTime)}</Text>
          <View style={{ flex: 1, height: 6, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 3, marginHorizontal: 12 }}>
            <View style={{ height: 6, width: `${progress}%`, backgroundColor: "#8b5cf6", borderRadius: 3 }} />
          </View>
          <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 14, width: 65, textAlign: "right" }}>{formatTime(duration)}</Text>
        </View>

        {/* Transport controls */}
        <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 32 }}>
          <Focusable onPress={() => onSeek(currentTime - 10)}>
            <View style={{ padding: 12 }}>
              <Text style={{ color: "#fff", fontSize: 18, fontWeight: "600" }}>-10s</Text>
            </View>
          </Focusable>
          <Focusable onPress={onPlayPause} hasTVPreferredFocus>
            <View style={{
              width: 64, height: 64, borderRadius: 32, backgroundColor: "#8b5cf6",
              justifyContent: "center", alignItems: "center",
            }}>
              <Text style={{ color: "#fff", fontSize: 28 }}>{paused ? "▶" : "⏸"}</Text>
            </View>
          </Focusable>
          <Focusable onPress={() => onSeek(currentTime + 30)}>
            <View style={{ padding: 12 }}>
              <Text style={{ color: "#fff", fontSize: 18, fontWeight: "600" }}>+30s</Text>
            </View>
          </Focusable>
          <Focusable onPress={onSettings}>
            <View style={{ padding: 12 }}>
              <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 18 }}>⚙</Text>
            </View>
          </Focusable>
        </View>
      </View>
    </Animated.View>
  );
}
