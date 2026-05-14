import { type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

interface Props {
  direction?: "top" | "bottom";
  height?: number | string;
  color?: string;
  style?: ViewStyle;
  /** Intensité du fade. "strong" pour cinema-fade hero, "soft" pour texte over media. */
  intensity?: "soft" | "strong";
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

/**
 * Overlay gradient — par défaut bottom-to-top fade vers pure black `#000000`.
 * Utilisé pour les hero billboards (cinematic fade), les overlays sur
 * posters, etc. `intensity="strong"` rapproche le fade des 60% pour un
 * effet plus dramatique.
 */
export function GradientOverlay({
  direction = "bottom", height, color = "#000000", style, intensity = "strong",
}: Props) {
  const stops = intensity === "strong" ? [0, 0.35, 0.7, 1] : [0, 0.35, 0.75, 1];
  const alphas = intensity === "strong"
    ? [0, 0.25, 0.7, 1]
    : [0, 0.1, 0.4, 0.85];

  const gradientColors: [string, string, ...string[]] = direction === "bottom"
    ? alphas.map((a) => withOpacity(color, a)) as [string, string, ...string[]]
    : [...alphas].reverse().map((a) => withOpacity(color, a)) as [string, string, ...string[]];

  const locations: [number, number, ...number[]] = stops as [number, number, ...number[]];

  return (
    <LinearGradient
      colors={gradientColors}
      locations={locations}
      style={[{
        position: "absolute",
        bottom: direction === "bottom" ? 0 : undefined,
        top: direction === "top" ? 0 : undefined,
        left: 0, right: 0,
        height: height as number ?? "55%",
      }, style]}
    />
  );
}
