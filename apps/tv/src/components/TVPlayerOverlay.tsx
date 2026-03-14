import { memo, useEffect } from "react";
import { View, Text } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import LinearGradient from "react-native-linear-gradient";
import { Focusable } from "./focus/Focusable";
import { PlayIcon, PauseIcon, BackIcon, SkipForwardIcon, SkipBackIcon, SettingsIcon, NextTrackIcon, PrevTrackIcon } from "./icons/TVIcons";
import { Colors } from "../theme/colors";
interface TVPlayerOverlayProps {
  title: string;
  currentTime: number;
  /** How far the video has been buffered (seconds) */
  bufferedTime?: number;
  duration: number;
  paused: boolean;
  visible: boolean;
  /** Current fast-forward/rewind speed label (e.g. ">>2x"), or null */
  speedLabel?: string | null;
  onPlayPause: () => void;
  /** Skip back uses ref-based time — no stale closure */
  onSkipBack: () => void;
  /** Skip forward uses ref-based time — no stale closure */
  onSkipForward: () => void;
  onBack: () => void;
  onSettings: () => void;
  /** When true, seekbar gets hasTVPreferredFocus instead of play/pause */
  seekActive?: boolean;
  onSeekBarFocus?: () => void;
  onSeekBarBlur?: () => void;
  /** Next episode — hidden if not provided */
  onNextEpisode?: () => void;
  /** Restart / previous episode (double-click) */
  onPrevEpisode?: () => void;
  hasNextEpisode?: boolean;
  hasPreviousEpisode?: boolean;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export const TVPlayerOverlay = memo(function TVPlayerOverlay({
  title, currentTime, bufferedTime = 0, duration, paused, visible,
  speedLabel, seekActive = false,
  onPlayPause, onSkipBack, onSkipForward,
  onBack, onSettings, onSeekBarFocus, onSeekBarBlur,
  onNextEpisode, onPrevEpisode, hasNextEpisode, hasPreviousEpisode,
}: TVPlayerOverlayProps) {
  const opacity = useSharedValue(visible ? 1 : 0);

  useEffect(() => {
    opacity.value = withTiming(visible || paused ? 1 : 0, { duration: 250 });
  }, [visible, paused, opacity]);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const buffered = duration > 0 ? (bufferedTime / duration) * 100 : 0;
  const isShown = visible || paused;

  return (
    <Animated.View
      renderToHardwareTextureAndroid
      pointerEvents={isShown ? "box-none" : "none"}
      accessible={isShown}
      // @ts-ignore — Android TV accessibility
      importantForAccessibility={isShown ? "auto" : "no-hide-descendants"}
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
          <Focusable variant="button" onPress={onBack}>
            <View style={{ padding: 10 }}>
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

      {/* Bottom gradient with controls */}
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.8)"]}
        style={{ paddingHorizontal: 40, paddingBottom: 48, paddingTop: 80 }}
      >
        {/* Progress bar — Focusable so D-pad seek gives it focus */}
        <Focusable
          variant="button"
          hasTVPreferredFocus={seekActive}
          focusRadius={6}
          style={{ marginBottom: 24 }}
          onFocus={onSeekBarFocus}
          onBlur={onSeekBarBlur}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text style={{ color: Colors.textSecondary, fontSize: 16, fontWeight: "500", width: 76 }}>
              {formatTime(currentTime)}
            </Text>
            <View style={{
              flex: 1, height: 5, backgroundColor: "rgba(255,255,255,0.15)",
              borderRadius: 3, marginHorizontal: 16, overflow: "hidden",
            }}>
              {/* Buffer bar */}
              <View style={{
                position: "absolute", top: 0, left: 0, bottom: 0,
                width: `${Math.min(buffered, 100)}%`,
                minWidth: buffered > progress ? 8 : 0,
                backgroundColor: "rgba(255,255,255,0.4)", borderRadius: 3,
              }} />
              {/* Playback progress */}
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
              color: Colors.textSecondary, fontSize: 16, fontWeight: "500",
              width: 76, textAlign: "right",
            }}>
              {formatTime(duration)}
            </Text>
          </View>
        </Focusable>

        {/* Transport controls */}
        <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 32 }}>
          {hasPreviousEpisode && (
            <Focusable variant="button" onPress={onPrevEpisode}>
              <View style={{ padding: 10 }}>
                <PrevTrackIcon size={20} color={Colors.textSecondary} />
              </View>
            </Focusable>
          )}

          <Focusable variant="button" onPress={onSkipBack}>
            <View style={{ padding: 12, flexDirection: "row", alignItems: "center", gap: 6 }}>
              <SkipBackIcon size={22} color={Colors.textPrimary} />
              <Text style={{ color: Colors.textSecondary, fontSize: 16, fontWeight: "600" }}>10s</Text>
            </View>
          </Focusable>

          <Focusable variant="button" onPress={onPlayPause} hasTVPreferredFocus={visible && !seekActive}>
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

          <Focusable variant="button" onPress={onSkipForward}>
            <View style={{ padding: 12, flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={{ color: Colors.textSecondary, fontSize: 16, fontWeight: "600" }}>30s</Text>
              <SkipForwardIcon size={22} color={Colors.textPrimary} />
            </View>
          </Focusable>

          {hasNextEpisode && (
            <Focusable variant="button" onPress={onNextEpisode}>
              <View style={{ padding: 10 }}>
                <NextTrackIcon size={20} color={Colors.textSecondary} />
              </View>
            </Focusable>
          )}

          <Focusable variant="button" onPress={onSettings}>
            <View style={{ padding: 13 }}>
              <SettingsIcon size={22} color={Colors.textSecondary} />
            </View>
          </Focusable>
        </View>
      </LinearGradient>
    </Animated.View>
  );
});
