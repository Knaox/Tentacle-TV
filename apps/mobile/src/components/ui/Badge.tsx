import { View, Text, StyleSheet, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { typography, FONT_FAMILY, LETTER_SPACING, RADIUS, progressGradient, useTheme, withAlpha } from "../../theme";
import type { AppTheme } from "../../theme";

/**
 * `onMedia` : posé sur une affiche — noir translucide et blanc constants dans
 * les deux thèmes (un jeton de texte thème-dépendant y devient illisible en
 * clair). `gradient` : le dégradé de marque du web (« Découverte »).
 */
type Variant = "accent" | "success" | "gold" | "muted" | "danger" | "warning" | "info" | "brand" | "onMedia" | "gradient";

interface Props {
  label: string;
  variant?: Variant;
  style?: ViewStyle;
  uppercase?: boolean;
}

interface BadgeStyle {
  bg: string;
  text: string;
  border?: string;
}

function variantStyle(t: AppTheme, variant: Variant): BadgeStyle {
  const { colors } = t;
  switch (variant) {
    case "brand":
    case "accent": // alias legacy
      return { bg: colors.brand.soft, text: colors.brand.light };
    case "success":
      return { bg: colors.statusPairs.success.bg, text: colors.statusPairs.success.fg };
    case "warning":
      return { bg: colors.statusPairs.warning.bg, text: colors.statusPairs.warning.fg };
    case "info":
      return { bg: colors.statusPairs.info.bg, text: colors.statusPairs.info.fg };
    case "danger":
      return { bg: colors.statusPairs.error.bg, text: colors.statusPairs.error.fg };
    case "gold":
      return {
        bg: withAlpha(colors.status.rating, 0.18, colors.statusPairs.warning.bg),
        text: colors.status.rating,
      };
    case "muted":
      return { bg: colors.fill.soft, text: colors.text.tertiary };
    case "onMedia":
      return { bg: "rgba(0, 0, 0, 0.65)", text: colors.onMedia.primary, border: colors.onMedia.muted };
    case "gradient":
      return { bg: "transparent", text: colors.cta.brandFg };
  }
}

export function Badge({ label, variant = "muted", style, uppercase = true }: Props) {
  const theme = useTheme();
  const v = variantStyle(theme, variant);
  const gradient = variant === "gradient" ? progressGradient(theme.colors.brand) : null;
  return (
    <View
      style={[
        {
          backgroundColor: v.bg,
          paddingHorizontal: 8,
          paddingVertical: 3.5,
          borderRadius: RADIUS.xs,
          alignSelf: "flex-start",
          overflow: "hidden",
        },
        v.border ? { borderWidth: StyleSheet.hairlineWidth, borderColor: v.border } : null,
        style,
      ]}
    >
      {gradient && (
        <LinearGradient colors={gradient.colors} start={gradient.start} end={gradient.end} style={StyleSheet.absoluteFill} />
      )}
      <Text
        style={{
          ...typography.badge,
          fontFamily: FONT_FAMILY.bold,
          letterSpacing: LETTER_SPACING.wide,
          color: v.text,
          textTransform: uppercase ? "uppercase" : "none",
        }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}
