import { Pressable, Text } from "react-native";
import { BORDER, BRAND, FONT_FAMILY, RADIUS } from "../../theme";

interface Props {
  label: string;
  active: boolean;
  onPress: () => void;
}

/** Chip filter pour SupportScreen list/new. */
export function Chip({ label, active, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [
        {
          backgroundColor: active ? BRAND.soft : "rgba(255,255,255,0.06)",
          borderWidth: 1,
          borderColor: active ? "rgba(139,92,246,0.45)" : BORDER.subtle,
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
        color: active ? BRAND.light : "rgba(255,255,255,0.6)",
        letterSpacing: 0.1,
      }}>
        {label}
      </Text>
    </Pressable>
  );
}
