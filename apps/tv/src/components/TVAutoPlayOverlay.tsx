import { useEffect } from "react";
import { View, Text, Image, TVFocusGuideView } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
} from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { Focusable } from "./focus/Focusable";
import { useTVRemote } from "./focus/useTVRemote";
import { PlayIcon, CloseIcon } from "./icons/TVIcons";
import { Colors } from "../theme/colors";

const COUNTDOWN_TOTAL = 10;

interface TVAutoPlayOverlayProps {
  countdown: number;
  episodeTitle?: string;
  episodeDescription?: string;
  episodeImageUrl?: string;
  onPlayNow: () => void;
  onDismiss: () => void;
}

export function TVAutoPlayOverlay({
  countdown, episodeTitle, episodeDescription, episodeImageUrl,
  onPlayNow, onDismiss,
}: TVAutoPlayOverlayProps) {
  const { t } = useTranslation("player");
  const progress = ((COUNTDOWN_TOTAL - countdown) / COUNTDOWN_TOTAL) * 100;

  // Back button dismisses the overlay
  useTVRemote({ onBack: onDismiss });

  // Slide-up + fade-in animation on mount
  const translateY = useSharedValue(60);
  const opacity = useSharedValue(0);

  useEffect(() => {
    translateY.value = withSpring(0, { damping: 20, stiffness: 200 });
    opacity.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) });
  }, [translateY, opacity]);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      // @ts-ignore — Android TV accessibility
      importantForAccessibility="yes"
      style={[{
        position: "absolute",
        bottom: 48,
        right: 48,
        width: 380,
        borderRadius: 12,
        backgroundColor: "rgba(18, 18, 26, 0.95)",
        borderWidth: 1,
        borderColor: "rgba(139, 92, 246, 0.2)",
        overflow: "hidden",
        zIndex: 60,
        elevation: 60,
      }, containerStyle]}
    >
      {/* Progress bar */}
      <View style={{ height: 3, backgroundColor: "rgba(255, 255, 255, 0.1)" }}>
        <View style={{
          height: 3,
          width: `${progress}%`,
          backgroundColor: Colors.accentPurple,
        }} />
      </View>

      {/* @ts-ignore — TVFocusGuideView props from react-native-tvos */}
      <TVFocusGuideView autoFocus trapFocusUp trapFocusDown trapFocusLeft trapFocusRight style={{ padding: 16 }}>
        {/* Header */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <Text style={{
            color: Colors.accentPurple,
            fontSize: 12,
            fontWeight: "700",
            letterSpacing: 1,
            textTransform: "uppercase",
          }}>
            {t("upNext")}
          </Text>
          <Focusable variant="button" onPress={onDismiss}>
            <View style={{ padding: 4 }}>
              <CloseIcon size={16} color="rgba(255, 255, 255, 0.4)" />
            </View>
          </Focusable>
        </View>

        {/* Content row */}
        <View style={{ flexDirection: "row", gap: 12 }}>
          {episodeImageUrl && (
            <Image
              source={{ uri: episodeImageUrl }}
              style={{
                width: 128, height: 72,
                borderRadius: 6,
                backgroundColor: "rgba(255, 255, 255, 0.05)",
              }}
              resizeMode="cover"
            />
          )}
          <View style={{ flex: 1, justifyContent: "center" }}>
            {episodeTitle && (
              <Text numberOfLines={1} style={{ color: Colors.textPrimary, fontSize: 14, fontWeight: "600" }}>
                {episodeTitle}
              </Text>
            )}
            {episodeDescription && (
              <Text numberOfLines={2} style={{
                color: "rgba(255, 255, 255, 0.5)",
                fontSize: 12, marginTop: 2, lineHeight: 18,
              }}>
                {episodeDescription}
              </Text>
            )}
          </View>
        </View>

        {/* Actions */}
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 14, gap: 12 }}>
          <Focusable variant="button" onPress={onPlayNow} hasTVPreferredFocus>
            <View style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              backgroundColor: Colors.accentPurple,
              paddingVertical: 10,
              paddingHorizontal: 16,
              borderRadius: 6,
            }}>
              <PlayIcon size={16} color={Colors.textPrimary} />
              <Text style={{ color: Colors.textPrimary, fontSize: 14, fontWeight: "700" }}>
                {t("playNow")}
              </Text>
            </View>
          </Focusable>
          <Text style={{ color: "rgba(255, 255, 255, 0.4)", fontSize: 12, fontVariant: ["tabular-nums"] }}>
            {countdown}{t("secondsShort")}
          </Text>
        </View>
      </TVFocusGuideView>
    </Animated.View>
  );
}
