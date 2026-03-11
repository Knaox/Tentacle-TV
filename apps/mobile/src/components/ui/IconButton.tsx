import { Pressable, type ViewStyle } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors } from "../../theme";

const ICON_MAP: Record<string, keyof typeof Feather.glyphMap> = {
  "←": "arrow-left",
  "→": "arrow-right",
  "✕": "x",
  "×": "x",
};

interface Props {
  icon: string;
  onPress: () => void;
  size?: number;
  style?: ViewStyle;
  color?: string;
  bgColor?: string;
  accessibilityLabel?: string;
}

export function IconButton({ icon, onPress, size = 36, style, color, bgColor, accessibilityLabel }: Props) {
  const featherName = ICON_MAP[icon] ?? (icon as keyof typeof Feather.glyphMap);

  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bgColor ?? "rgba(0,0,0,0.5)",
        justifyContent: "center",
        alignItems: "center",
      }, style]}
    >
      <Feather name={featherName} size={Math.round(size * 0.5)} color={color ?? colors.textPrimary} />
    </Pressable>
  );
}
