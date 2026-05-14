import { Pressable, Text, ActivityIndicator, type ViewStyle, type TextStyle } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";
import { colors, spacing, typography, BRAND, CTA, FONT_FAMILY, RADIUS } from "../../theme";

// expo-haptics may not be available in all Expo Go builds
let Haptics: { impactAsync: (style: any) => void; ImpactFeedbackStyle: any } | null = null;
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

const variants: Record<Variant, VariantStyle> = {
  // Netflix CTA principal — white pill, black text, soft shadow
  primary: {
    bg: CTA.primaryBg,
    text: CTA.primaryFg,
    shadow: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 10,
      elevation: 4,
    },
  },
  // Netflix CTA secondaire — gris translucide cinematic
  secondary: {
    bg: CTA.secondaryBg,
    text: CTA.secondaryFg,
  },
  // Danger — rouge sur surface tinted
  danger: {
    bg: colors.dangerSurface,
    text: colors.danger,
    border: colors.dangerBorder,
  },
  // Ghost — transparent, hover/press tint
  ghost: {
    bg: "transparent",
    text: colors.textSecondary,
  },
};

const labelStyle: TextStyle = {
  ...typography.bodyBold,
  fontFamily: FONT_FAMILY.semibold,
  letterSpacing: 0.1,
};

export function Button({ title, onPress, variant = "primary", loading, disabled, style, fullWidth, accessibilityLabel }: Props) {
  const v = variants[variant];
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
          borderRadius: RADIUS.md,
          paddingVertical: 14,
          paddingHorizontal: 22,
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
        {loading ? (
          <ActivityIndicator color={v.text} size="small" />
        ) : (
          <Text style={{ ...labelStyle, color: v.text }} numberOfLines={1}>
            {title}
          </Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

/** Exporté pour permettre des CTAs cohérents en grand format (Hero billboard). */
export const BUTTON_BRAND_TINT = BRAND.violet;
