import { Pressable, Text } from "react-native";
import { FONT_FAMILY, RADIUS, useTheme } from "../../theme";

interface Props {
  label: string;
  active: boolean;
  onPress: () => void;
}

/** Chip filter pour SupportScreen list/new. */
export function Chip({ label, active, onPress }: Props) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [
        {
          backgroundColor: active ? colors.brand.soft : colors.fill.subtle,
          borderWidth: 1,
          borderColor: active ? colors.brand.glow : colors.border.subtle,
          paddingHorizontal: 14,
          paddingVertical: 8,
          minHeight: 44,
          borderRadius: RADIUS.pill,
          justifyContent: "center",
        },
        pressed && { opacity: 0.85 },
      ]}
    >
      <Text style={{
        fontSize: 13,
        fontFamily: active ? FONT_FAMILY.semibold : FONT_FAMILY.medium,
        color: active ? colors.brand.light : colors.text.tertiary,
        letterSpacing: 0.1,
      }}>
        {label}
      </Text>
    </Pressable>
  );
}
