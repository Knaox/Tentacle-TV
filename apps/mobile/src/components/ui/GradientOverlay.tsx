import { type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

interface Props {
  direction?: "top" | "bottom";
  height?: number | string;
  color?: string;
  style?: ViewStyle;
}

function withOpacity(color: string, opacity: number): string {
  const rgbaMatch = color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/);
  if (rgbaMatch) {
    const [, r, g, b, a] = rgbaMatch;
    const baseAlpha = a !== undefined ? parseFloat(a) : 1;
    return `rgba(${r}, ${g}, ${b}, ${(baseAlpha * opacity).toFixed(2)})`;
  }
  const hex = Math.round(opacity * 255).toString(16).padStart(2, "0");
  return `${color}${hex}`;
}

export function GradientOverlay({ direction = "bottom", height, color = "#0a0a0f", style }: Props) {
  const gradientColors: [string, string, ...string[]] = direction === "bottom"
    ? ["transparent", withOpacity(color, 0.2), withOpacity(color, 0.6), color]
    : [color, withOpacity(color, 0.6), withOpacity(color, 0.2), "transparent"];
  const locations: [number, number, ...number[]] = direction === "bottom"
    ? [0, 0.3, 0.65, 1]
    : [0, 0.35, 0.7, 1];

  return (
    <LinearGradient
      colors={gradientColors}
      locations={locations}
      style={[{
        position: "absolute",
        bottom: direction === "bottom" ? 0 : undefined,
        top: direction === "top" ? 0 : undefined,
        left: 0, right: 0,
        height: height as number ?? "50%",
      }, style]}
    />
  );
}
