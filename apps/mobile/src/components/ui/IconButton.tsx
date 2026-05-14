import { Pressable, type ViewStyle } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { colors, OVERLAY } from "../../theme";

// expo-haptics may not be available in all Expo Go builds
let Haptics: { impactAsync: (style: any) => void; ImpactFeedbackStyle: any } | null = null;
try {
  Haptics = require("expo-haptics");
} catch { /* ignore */ }

const ICON_MAP: Record<string, keyof typeof Feather.glyphMap> = {
  "←": "arrow-left",
  "→": "arrow-right",
  "✕": "x",
  "×": "x",
};

interface Props {
  icon: string;
  onPress: () => void;
  size?: number;
  style?: ViewStyle;
  color?: string;
  bgColor?: string;
  accessibilityLabel?: string;
  haptic?: boolean;
}

/**
 * Bouton rond avec icône Feather. Press anim Reanimated (scale spring),
 * haptic léger optionnel, fond translucide noir par défaut (overlay
 * cinematic). Touch target garanti ≥ 44pt via hitSlop.
 */
export function IconButton({
  icon, onPress, size = 36, style, color, bgColor, accessibilityLabel, haptic = true,
}: Props) {
  const featherName = ICON_MAP[icon] ?? (icon as keyof typeof Feather.glyphMap);
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const hitSlop = Math.max(0, Math.round((44 - size) / 2));

  return (
    <Animated.View style={animStyle}>
      <Pressable
        onPress={() => {
          if (haptic) Haptics?.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
        onPressIn={() => { scale.value = withSpring(0.9, { damping: 14, stiffness: 320 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 14, stiffness: 320 }); }}
        hitSlop={hitSlop}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={[{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bgColor ?? OVERLAY.scrim,
          justifyContent: "center" as const,
          alignItems: "center" as const,
        }, style]}
      >
        <Feather name={featherName} size={Math.round(size * 0.5)} color={color ?? colors.textPrimary} />
      </Pressable>
    </Animated.View>
  );
}
