import { View, Text } from "react-native";
import { colors, typography, spacing } from "../../theme";

type Variant = "accent" | "success" | "gold" | "muted" | "danger";

interface Props {
  label: string;
  variant?: Variant;
}

const variantStyles: Record<Variant, { bg: string; text: string }> = {
  accent: { bg: colors.accentMuted, text: colors.accentLight },
  success: { bg: "rgba(34, 197, 94, 0.15)", text: colors.success },
  gold: { bg: "rgba(251, 191, 36, 0.15)", text: colors.gold },
  muted: { bg: "rgba(255, 255, 255, 0.06)", text: "rgba(255, 255, 255, 0.5)" },
  danger: { bg: colors.dangerSurface, text: colors.danger },
};

export function Badge({ label, variant = "muted" }: Props) {
  const v = variantStyles[variant];
  return (
    <View style={{
      backgroundColor: v.bg,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: spacing.badgeRadius,
    }}>
      <Text style={{ ...typography.badge, color: v.text }}>{label}</Text>
    </View>
  );
}
