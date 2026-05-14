import { View, Text, type ViewStyle } from "react-native";
import { colors, typography, BRAND, STATUS, STATUS_PAIRS, FONT_FAMILY, LETTER_SPACING, RADIUS } from "../../theme";

type Variant = "accent" | "success" | "gold" | "muted" | "danger" | "warning" | "info" | "brand";

interface Props {
  label: string;
  variant?: Variant;
  style?: ViewStyle;
  uppercase?: boolean;
}

interface BadgeStyle {
  bg: string;
  text: string;
}

const variantStyles: Record<Variant, BadgeStyle> = {
  brand: { bg: BRAND.soft, text: BRAND.light },
  // alias legacy
  accent: { bg: BRAND.soft, text: BRAND.light },
  success: { bg: STATUS_PAIRS.success.bg, text: STATUS_PAIRS.success.fg },
  warning: { bg: STATUS_PAIRS.warning.bg, text: STATUS_PAIRS.warning.fg },
  info: { bg: STATUS_PAIRS.info.bg, text: STATUS_PAIRS.info.fg },
  danger: { bg: STATUS_PAIRS.error.bg, text: STATUS_PAIRS.error.fg },
  gold: { bg: "rgba(251, 191, 36, 0.18)", text: STATUS.rating },
  muted: { bg: "rgba(255, 255, 255, 0.08)", text: "rgba(255, 255, 255, 0.62)" },
};

export function Badge({ label, variant = "muted", style, uppercase = true }: Props) {
  const v = variantStyles[variant];
  return (
    <View
      style={[
        {
          backgroundColor: v.bg,
          paddingHorizontal: 8,
          paddingVertical: 3.5,
          borderRadius: RADIUS.xs,
          alignSelf: "flex-start",
        },
        style,
      ]}
    >
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

/** Export helper pour stats colors (utilisé par certains composants ailleurs). */
export const BADGE_COLORS = { gold: colors.gold } as const;
