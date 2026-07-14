import { Pressable, StyleSheet, type ViewStyle } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../../theme";

// expo-haptics may not be available in all Expo Go builds
let Haptics: { impactAsync: (style: unknown) => void; ImpactFeedbackStyle: Record<string, unknown> } | null = null;
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
  /**
   * Bouton posé sur une image (backdrop) : fond scrim SOMBRE + icône claire,
   * dans les deux thèmes. Par défaut (false), rendu neutre subtil adapté aux
   * surfaces planes (réglages, à propos…) — plus de gros cercle noir en clair.
   */
  onMedia?: boolean;
}

/**
 * Bouton rond avec icône Feather. Press anim Reanimated (scale spring),
 * haptic léger optionnel. Deux rendus : neutre subtil (surface plane, défaut)
 * ou scrim sombre (`onMedia`, sur backdrop). Touch target ≥ 44pt via hitSlop.
 */
export function IconButton({
  icon, onPress, size = 36, style, color, bgColor, accessibilityLabel, haptic = true, onMedia = false,
}: Props) {
  const theme = useTheme();
  const featherName = ICON_MAP[icon] ?? (icon as keyof typeof Feather.glyphMap);
  // Sur média : scrim sombre + icône claire (lisible sur affiche). Sinon : puce
  // neutre translucide + bord hairline (élégant sur fond clair comme sombre).
  const defaultBg = onMedia ? theme.colors.overlay.scrim : theme.colors.fill.soft;
  const iconColor = color ?? (onMedia ? theme.colors.onMedia.primary : theme.colors.text.primary);
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
          backgroundColor: bgColor ?? defaultBg,
          justifyContent: "center" as const,
          alignItems: "center" as const,
        }, !onMedia && !bgColor ? { borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.border.subtle } : null, style]}
      >
        <Feather name={featherName} size={Math.round(size * 0.5)} color={iconColor} />
      </Pressable>
    </Animated.View>
  );
}
