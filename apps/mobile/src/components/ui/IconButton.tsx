import { Platform, Pressable, StyleSheet, type ViewStyle } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../../theme";
import { haptic as playHaptic } from "../../utils/haptics";
import { GlassFill } from "./buttons/GlassFill";
import { MIN_TARGET } from "./buttons/buttonLook";

const ICON_MAP: Record<string, keyof typeof Feather.glyphMap> = {
  "←": "arrow-left",
  "→": "arrow-right",
  "✕": "x",
  "×": "x",
};

const PLATFORM = Platform.OS === "android" ? "android" : "ios";

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
   * - `tonal` (défaut) : puce neutre translucide + liseré d'un cheveu, pour
   *   les surfaces de l'app (réglages, en-têtes, feuilles).
   * - `plain` : le pictogramme seul (barres d'outils, fermer une feuille).
   * - `glass` : posé sur une IMAGE — Liquid Glass (iOS 26), flou (iOS
   *   d'avant), voile sombre (Android).
   */
  variant?: "tonal" | "plain" | "glass";
  /** Ancien nom de `variant="glass"`. */
  onMedia?: boolean;
}

/**
 * Bouton rond à pictogramme Feather — le `IconButton` du système de boutons
 * (`./buttons`). Cible tactile ≥ 44 pt / 48 dp par `hitSlop`, quelle que soit
 * la taille dessinée. Appui : léger rétrécissement (ressort), haptique.
 */
export function IconButton({
  icon, onPress, size = 36, style, color, bgColor, accessibilityLabel, haptic = true, variant, onMedia = false,
}: Props) {
  const theme = useTheme();
  const kind = variant ?? (onMedia ? "glass" : "tonal");
  const featherName = ICON_MAP[icon] ?? (icon as keyof typeof Feather.glyphMap);
  const iconColor = color ?? (kind === "glass" ? theme.colors.onMedia.primary : theme.colors.text.primary);
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const hitSlop = Math.max(0, Math.round((MIN_TARGET[PLATFORM] - size) / 2));
  const radius = size / 2;
  const surface: ViewStyle | null =
    bgColor
      ? { backgroundColor: bgColor }
      : kind === "tonal"
        ? { backgroundColor: theme.colors.fill.soft, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.border.subtle }
        : null;

  return (
    <Animated.View style={animStyle}>
      <Pressable
        onPress={() => {
          if (haptic) playHaptic("tap");
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
          borderRadius: radius,
          justifyContent: "center" as const,
          alignItems: "center" as const,
        }, surface, style]}
      >
        {kind === "glass" && !bgColor ? <GlassFill radius={radius} /> : null}
        <Feather name={featherName} size={Math.round(size * 0.5)} color={iconColor} />
      </Pressable>
    </Animated.View>
  );
}
