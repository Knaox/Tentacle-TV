import { useEffect } from "react";
import { View, Text } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import LinearGradient from "react-native-linear-gradient";
import { Focusable } from "./focus/Focusable";
import { PlayIcon, PauseIcon, BackIcon, SkipForwardIcon, SkipBackIcon, SettingsIcon } from "./icons/TVIcons";
import { Colors } from "../theme/colors";
import type { SegmentTimestamps } from "@tentacle-tv/shared";

interface TVPlayerOverlayProps {
  title: string;
  currentTime: number;
  duration: number;
  paused: boolean;
  visible: boolean;
  /** Current fast-forward/rewind speed label (e.g. ">>2x"), or null */
  speedLabel?: string | null;
  introSegment?: SegmentTimestamps | null;
  creditsSegment?: SegmentTimestamps | null;
  onPlayPause: () => void;
  /** Skip back uses ref-based time — no stale closure */
  onSkipBack: () => void;
  /** Skip forward uses ref-based time — no stale closure */
  onSkipForward: () => void;
  onSkipIntro?: () => void;
  onSkipCredits?: () => void;
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
  title, currentTime, duration, paused, visible,
  speedLabel, introSegment, creditsSegment,
  onPlayPause, onSkipBack, onSkipForward,
  onSkipIntro, onSkipCredits, onBack, onSettings,
}: TVPlayerOverlayProps) {
  const opacity = useSharedValue(visible ? 1 : 0);

  useEffect(() => {
    opacity.value = withTiming(visible || paused ? 1 : 0, { duration: 250 });
  }, [visible, paused, opacity]);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const isShown = visible || paused;

  const showSkipIntro = introSegment
    && currentTime >= introSegment.start
    && currentTime < introSegment.end - 1;
  const showSkipCredits = creditsSegment
    && currentTime >= creditsSegment.start
    && currentTime < creditsSegment.end - 1;

  return (
    <Animated.View
      pointerEvents={isShown ? "auto" : "none"}
      style={[{
        position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
        justifyContent: "space-between",
      }, animStyle]}
    >
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

      {/* Speed indicator (fast forward / rewind) */}
      {!!speedLabel && (
        <View style={{
          position: "absolute", top: "45%", alignSelf: "center",
          backgroundColor: "rgba(0,0,0,0.7)", borderRadius: 12,
          paddingHorizontal: 24, paddingVertical: 12,
        }}>
          <Text style={{
            color: Colors.textPrimary, fontSize: 28, fontWeight: "800",
          }}>
            {speedLabel}
          </Text>
        </View>
      )}

      {/* Skip intro / credits buttons */}
      {showSkipIntro && onSkipIntro && (
        <View style={{
          position: "absolute", bottom: 180, right: 40,
        }}>
          <Focusable onPress={onSkipIntro} focusRadius={8}>
            <View style={{
              paddingHorizontal: 20, paddingVertical: 10,
              backgroundColor: "rgba(0,0,0,0.6)",
              borderWidth: 1, borderColor: "rgba(255,255,255,0.2)",
              borderRadius: 8,
            }}>
              <Text style={{
                color: Colors.textPrimary, fontSize: 15, fontWeight: "600",
              }}>
                Passer l'intro
              </Text>
            </View>
          </Focusable>
        </View>
      )}
      {showSkipCredits && onSkipCredits && (
        <View style={{
          position: "absolute", bottom: 180, right: 40,
        }}>
          <Focusable onPress={onSkipCredits} focusRadius={8}>
            <View style={{
              paddingHorizontal: 20, paddingVertical: 10,
              backgroundColor: "rgba(0,0,0,0.6)",
              borderWidth: 1, borderColor: "rgba(255,255,255,0.2)",
              borderRadius: 8,
            }}>
              <Text style={{
                color: Colors.textPrimary, fontSize: 15, fontWeight: "600",
              }}>
                Passer le generique
              </Text>
            </View>
          </Focusable>
        </View>
      )}

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
          <Focusable onPress={onSkipBack}>
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

          <Focusable onPress={onSkipForward}>
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
