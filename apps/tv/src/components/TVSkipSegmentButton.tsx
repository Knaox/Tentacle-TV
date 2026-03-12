import { useEffect, useState } from "react";
import { View, Text } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { Focusable } from "./focus/Focusable";
import { useTVRemote } from "./focus/useTVRemote";
import { Colors } from "../theme/colors";
import type { SegmentTimestamps } from "@tentacle-tv/shared";

interface TVSkipSegmentButtonProps {
  type: "intro" | "credits";
  segment?: SegmentTimestamps | null;
  currentTime: number;
  onSkip: () => void;
  /** When true, don't steal focus (overlay or settings panel is active) */
  overlayVisible?: boolean;
  showSettings?: boolean;
}

export function TVSkipSegmentButton({ type, segment, currentTime, onSkip, overlayVisible = false, showSettings = false }: TVSkipSegmentButtonProps) {
  const { t } = useTranslation("player");
  const [dismissed, setDismissed] = useState(false);

  const inRange = !!segment
    && currentTime >= segment.start
    && currentTime < segment.end - 1;
  const visible = inRange && !dismissed;

  // For credits: pressing Back dismisses the popup
  useTVRemote({
    onBack: type === "credits" && visible ? () => setDismissed(true) : undefined,
  });

  // Reset dismissed state when segment goes out of range
  useEffect(() => {
    if (!inRange) setDismissed(false);
  }, [inRange]);

  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(visible ? 1 : 0, { duration: 250 });
  }, [visible, opacity]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  if (!segment || !visible) return null;

  return (
    <Animated.View
      pointerEvents="auto"
      style={[{
        position: "absolute",
        bottom: 140,
        right: 40,
        zIndex: 100,
      }, animStyle]}
    >
      <Focusable variant="button" onPress={onSkip} focusRadius={8} hasTVPreferredFocus={!overlayVisible && !showSettings}>
        <View style={{
          paddingHorizontal: 20,
          paddingVertical: 10,
          backgroundColor: "rgba(0,0,0,0.60)",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.20)",
          borderRadius: 8,
        }}>
          <Text style={{
            color: "#ffffff",
            fontSize: 16,
            fontWeight: "600",
          }}>
            {type === "intro" ? t("skipIntro") : t("skipCredits")}
          </Text>
        </View>
      </Focusable>
    </Animated.View>
  );
}
