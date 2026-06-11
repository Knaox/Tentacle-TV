import { memo, forwardRef } from "react";
import { View, Text, StyleSheet, type ViewStyle } from "react-native";
import { Focusable } from "../focus/Focusable";
import { Colors, Typography, Radius, Spacing } from "../../theme";

export type TVButtonVariant = "primary" | "secondary" | "ghost";

interface TVButtonProps {
  label: string;
  onPress?: () => void;
  /** primary = CTA blanc/noir façon web-Netflix ; secondary = gris translucide ; ghost = white/8. */
  variant?: TVButtonVariant;
  icon?: React.ReactNode;
  hasTVPreferredFocus?: boolean;
  disabled?: boolean;
  /** Bouton compact (paramètres, modals) vs large (hero, fiche détail). */
  size?: "large" | "medium";
  style?: ViewStyle;
  accessibilityLabel?: string;
  onFocus?: () => void;
  onBlur?: () => void;
}

/**
 * Bouton TV unifié — mêmes variants que les CTA du web (tokens --cta-*) :
 * focus = scale 1.07 + ring violet (géré par Focusable variant "button").
 */
export const TVButton = memo(forwardRef<View, TVButtonProps>(function TVButton({
  label,
  onPress,
  variant = "ghost",
  icon,
  hasTVPreferredFocus,
  disabled,
  size = "large",
  style,
  accessibilityLabel,
  onFocus,
  onBlur,
}, ref) {
  const palette = VARIANT_STYLES[variant];
  const sizing = size === "large" ? styles.large : styles.medium;
  const textStyle = size === "large" ? Typography.buttonLarge : Typography.buttonMedium;

  return (
    <Focusable
      ref={ref}
      variant="button"
      focusRadius={Radius.buttonLarge}
      onPress={disabled ? undefined : onPress}
      hasTVPreferredFocus={hasTVPreferredFocus}
      accessibilityLabel={accessibilityLabel ?? label}
      style={style}
      onFocus={onFocus}
      onBlur={onBlur}
    >
      <View style={[styles.base, sizing, palette.container, disabled && styles.disabled]}>
        {icon}
        <Text style={[textStyle, { color: palette.fg }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </Focusable>
  );
}));

const VARIANT_STYLES: Record<TVButtonVariant, { container: ViewStyle; fg: string }> = {
  primary: {
    container: { backgroundColor: Colors.ctaPrimaryBg },
    fg: Colors.ctaPrimaryFg,
  },
  secondary: {
    container: { backgroundColor: Colors.ctaSecondaryBg },
    fg: Colors.textPrimary,
  },
  ghost: {
    container: {
      backgroundColor: Colors.ctaGhostBg,
      borderWidth: 1,
      borderColor: Colors.ctaGhostBorder,
    },
    fg: Colors.textPrimary,
  },
};

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.buttonGap,
    borderRadius: Radius.buttonLarge,
  },
  large: { paddingHorizontal: 28, height: 52 },
  medium: { paddingHorizontal: 18, height: 42 },
  disabled: { opacity: 0.45 },
});
