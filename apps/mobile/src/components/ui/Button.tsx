import { Pressable, Text, ActivityIndicator, type ViewStyle } from "react-native";
import { colors, typography, spacing } from "../../theme";

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

const variants: Record<Variant, { bg: string; text: string; border?: string }> = {
  primary: { bg: colors.accent, text: "#fff" },
  secondary: { bg: "rgba(255,255,255,0.08)", text: "rgba(255,255,255,0.8)" },
  danger: { bg: colors.dangerSurface, text: colors.danger, border: colors.dangerBorder },
  ghost: { bg: "transparent", text: colors.textSecondary },
};

export function Button({ title, onPress, variant = "primary", loading, disabled, style, fullWidth, accessibilityLabel }: Props) {
  const v = variants[variant];
  const isDisabled = disabled || loading;

  const handlePress = () => {
    Haptics?.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: isDisabled }}
      style={[{
        backgroundColor: v.bg,
        borderRadius: spacing.buttonRadius,
        paddingVertical: 14,
        paddingHorizontal: 20,
        alignItems: "center" as const,
        opacity: isDisabled ? 0.5 : 1,
        borderWidth: v.border ? 1 : 0,
        borderColor: v.border,
        width: fullWidth ? "100%" : undefined,
      }, style]}
    >
      {loading ? (
        <ActivityIndicator color={v.text} size="small" />
      ) : (
        <Text style={{ ...typography.bodyBold, color: v.text }}>{title}</Text>
      )}
    </Pressable>
  );
}
