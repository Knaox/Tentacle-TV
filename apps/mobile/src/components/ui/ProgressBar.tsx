import { View, type ViewStyle } from "react-native";
import { colors } from "../../theme";

interface Props {
  progress: number; // 0-1
  height?: number;
  style?: ViewStyle;
}

export function ProgressBar({ progress, height = 3, style }: Props) {
  const clamped = Math.max(0, Math.min(1, progress));
  if (clamped === 0) return null;

  return (
    <View style={[{
      height,
      backgroundColor: "rgba(255, 255, 255, 0.1)",
      borderRadius: height / 2,
      overflow: "hidden",
    }, style]}>
      <View style={{
        width: `${clamped * 100}%` as unknown as number,
        height: "100%",
        borderRadius: height / 2,
        backgroundColor: colors.accent,
      }} />
    </View>
  );
}
