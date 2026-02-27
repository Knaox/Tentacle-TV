import { useState, useEffect, useRef, useCallback } from "react";
import { View, Text } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import LinearGradient from "react-native-linear-gradient";
import { useTranslation } from "react-i18next";
import { Focusable } from "./focus/Focusable";
import { PlayIcon, PauseIcon, BackIcon, SkipForwardIcon, SkipBackIcon, SettingsIcon } from "./icons/TVIcons";
import { Colors, Radius } from "../theme/colors";

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
  const { t } = useTranslation("player");
  const [visible, setVisible] = useState(true);
  const opacity = useSharedValue(1);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();

  const show = useCallback(() => {
    setVisible(true);
    opacity.value = withTiming(1, { duration: 150 });
    clearTimeout(hideTimer.current);
    if (!paused) {
      hideTimer.current = setTimeout(() => {
        opacity.value = withTiming(0, { duration: 300 });
        setTimeout(() => setVisible(false), 300);
      }, 5000);
    }
  }, [paused, opacity]);

  useEffect(() => {
    show();
    return () => clearTimeout(hideTimer.current);
  }, [paused, show]);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  if (!visible && !paused) return null;

  return (
    <Animated.View style={[{
      position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
      justifyContent: "space-between",
    }, animStyle]}>
      {/* Top gradient */}
      <LinearGradient
        colors={["rgba(0,0,0,0.7)", "transparent"]}
        style={{ paddingTop: 40, paddingHorizontal: 40, paddingBottom: 60 }}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Focusable onPress={onBack}>
            <View style={{ padding: 8 }}>
              <BackIcon size={28} color={Colors.textPrimary} />
            </View>
          </Focusable>
          <Text numberOfLines={1} style={{
            color: Colors.textPrimary, fontSize: 22, fontWeight: "600",
            marginLeft: 16, flex: 1,
          }}>
            {title}
          </Text>
        </View>
      </LinearGradient>

      {/* Bottom gradient with controls */}
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.8)"]}
        style={{ paddingHorizontal: 40, paddingBottom: 48, paddingTop: 80 }}
      >
        {/* Progress bar */}
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 24 }}>
          <Text style={{ color: Colors.textSecondary, fontSize: 14, fontWeight: "500", width: 72 }}>
            {formatTime(currentTime)}
          </Text>
          <View style={{
            flex: 1, height: 5, backgroundColor: "rgba(255,255,255,0.15)",
            borderRadius: 3, marginHorizontal: 16, overflow: "hidden",
          }}>
            <View style={{
              height: 5, width: `${Math.min(progress, 100)}%`,
              backgroundColor: Colors.accentPurple, borderRadius: 3,
            }} />
            {/* Scrubber dot */}
            <View style={{
              position: "absolute", top: -4,
              left: `${Math.min(progress, 100)}%`,
              marginLeft: -6,
              width: 13, height: 13, borderRadius: 7,
              backgroundColor: Colors.accentPurple,
              borderWidth: 2, borderColor: Colors.textPrimary,
            }} />
          </View>
          <Text style={{
            color: Colors.textSecondary, fontSize: 14, fontWeight: "500",
            width: 72, textAlign: "right",
          }}>
            {formatTime(duration)}
          </Text>
        </View>

        {/* Transport controls */}
        <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 40 }}>
          <Focusable onPress={() => onSeek(currentTime - 10)}>
            <View style={{ padding: 12, flexDirection: "row", alignItems: "center", gap: 6 }}>
              <SkipBackIcon size={22} color={Colors.textPrimary} />
              <Text style={{ color: Colors.textSecondary, fontSize: 14, fontWeight: "600" }}>10s</Text>
            </View>
          </Focusable>

          <Focusable onPress={onPlayPause} hasTVPreferredFocus>
            <View style={{
              width: 68, height: 68, borderRadius: 34,
              backgroundColor: Colors.accentPurple,
              justifyContent: "center", alignItems: "center",
            }}>
              {paused
                ? <PlayIcon size={28} color={Colors.textPrimary} />
                : <PauseIcon size={28} color={Colors.textPrimary} />
              }
            </View>
          </Focusable>

          <Focusable onPress={() => onSeek(currentTime + 30)}>
            <View style={{ padding: 12, flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={{ color: Colors.textSecondary, fontSize: 14, fontWeight: "600" }}>30s</Text>
              <SkipForwardIcon size={22} color={Colors.textPrimary} />
            </View>
          </Focusable>

          <Focusable onPress={onSettings}>
            <View style={{ padding: 12 }}>
              <SettingsIcon size={22} color={Colors.textSecondary} />
            </View>
          </Focusable>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}
