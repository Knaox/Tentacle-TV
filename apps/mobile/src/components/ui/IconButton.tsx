import { Pressable, Text, type ViewStyle } from "react-native";
import { colors } from "../../theme";

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
      <Text style={{ color: color ?? colors.textPrimary, fontSize: size * 0.5 }}>{icon}</Text>
    </Pressable>
  );
}
