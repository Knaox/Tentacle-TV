import { Pressable, Text, ActivityIndicator, View, StyleSheet, type ViewStyle, type TextStyle } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";

import { spacing, typography, FONT_FAMILY, RADIUS, useTheme } from "../../theme";
import type { AppTheme } from "../../theme";

// expo-haptics may not be available in all Expo Go builds
let Haptics: { impactAsync: (style: unknown) => void; ImpactFeedbackStyle: Record<string, unknown> } | null = null;
try {
  Haptics = require("expo-haptics");
} catch {
  // native module not available
}

type Variant = "primary" | "secondary" | "danger" | "ghost";

interface Props {
  title: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  fullWidth?: boolean;
  accessibilityLabel?: string;
}

interface VariantStyle {
  bg: string;
  text: string;
  border?: string;
  shadow?: ViewStyle;
}

// Les ombres restent noires dans les deux schemes (standard iOS).
const PRIMARY_SHADOW: ViewStyle = {
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.25,
  shadowRadius: 10,
  elevation: 4,
};

function variantStyle(t: AppTheme, variant: Variant): VariantStyle {
  const { colors } = t;
  switch (variant) {
    // CTA principal. En CLAIR : bouton blanc + fin contour sombre (primaryBorder)
    // + ombre douce neutre (shadow.card) + texte violet. En SOMBRE : pilule
    // blanche + ombre noire historique, sans contour.
    case "primary":
      return {
        bg: colors.cta.primaryBg,
        text: colors.cta.primaryFg,
        border: colors.cta.primaryBorder,
        shadow: t.isDark ? PRIMARY_SHADOW : colors.shadow.card,
      };
    // Netflix CTA secondaire — gris translucide cinematic
    case "secondary":
      return { bg: colors.cta.secondaryBg, text: colors.cta.secondaryFg };
    // Danger — rouge sur surface tinted
    case "danger":
      return { bg: colors.danger.surface, text: colors.status.error, border: colors.danger.border };
    // Ghost — transparent, texte secondaire
    case "ghost":
      return { bg: "transparent", text: colors.text.secondary };
  }
}

const labelStyle: TextStyle = {
  ...typography.bodyBold,
  fontFamily: FONT_FAMILY.semibold,
  letterSpacing: 0.1,
};

export function Button({ title, onPress, variant = "primary", loading, disabled, style, fullWidth, accessibilityLabel }: Props) {
  const theme = useTheme();
  const v = variantStyle(theme, variant);
  const isDisabled = disabled || loading;
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePressIn = () => {
    scale.value = withSpring(0.97, { damping: 18, stiffness: 280, mass: 0.7 });
  };
  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 18, stiffness: 280, mass: 0.7 });
  };
  const handlePress = () => {
    Haptics?.impactAsync(variant === "danger" ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  // Voile pressed révélé en OPACITÉ — l'équivalent natif du Veil desktop
  // (le hover n'existe pas au doigt, l'appui le remplace). Noir sur la pilule
  // blanche ; sinon selon le schéma. Il épouse le rayon, pas d'overflow:hidden
  // (qui couperait l'ombre iOS portée par le même élément).
  const veilColor =
    variant === "primary"
      ? "rgba(0, 0, 0, 0.07)"
      : theme.isDark
        ? "rgba(255, 255, 255, 0.08)"
        : "rgba(0, 0, 0, 0.06)";

  return (
    <Animated.View style={[animStyle, fullWidth ? { width: "100%" } : null]}>
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isDisabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? title}
        accessibilityState={{ disabled: isDisabled }}
        style={[{
          backgroundColor: v.bg,
          // La pilule de la nouvelle UI — même rayon que les CTA du desktop.
          borderRadius: RADIUS.pill,
          minHeight: 44,
          paddingVertical: 12,
          paddingHorizontal: 24,
          alignItems: "center" as const,
          justifyContent: "center" as const,
          flexDirection: "row" as const,
          opacity: isDisabled ? 0.45 : 1,
          borderWidth: v.border ? 1 : 0,
          borderColor: v.border,
          gap: spacing.sm,
          ...(v.shadow ?? {}),
        }, style]}
      >
        {({ pressed }) => (
          <>
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                { borderRadius: RADIUS.pill, backgroundColor: veilColor, opacity: pressed ? 1 : 0 },
              ]}
            />
            {loading ? (
              <ActivityIndicator color={v.text} size="small" />
            ) : (
              <Text style={{ ...labelStyle, color: v.text }} numberOfLines={1}>
                {title}
              </Text>
            )}
          </>
        )}
      </Pressable>
    </Animated.View>
  );
}
