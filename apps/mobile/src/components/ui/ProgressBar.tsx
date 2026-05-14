import { View, type ViewStyle } from "react-native";
import { colors, BRAND } from "../../theme";

interface Props {
  progress: number; // 0-1
  height?: number;
  style?: ViewStyle;
  /** Couleur de remplissage. Default = violet brand. */
  tint?: string;
  /** Affiche même quand progress = 0 (utile pour squelettes). */
  showEmpty?: boolean;
}

/**
 * Barre de progression fine — Netflix-style. Default 3px, fond translucide
 * blanc 10%, remplissage violet brand avec glow subtle.
 */
export function ProgressBar({ progress, height = 3, style, tint = BRAND.violet, showEmpty = false }: Props) {
  const clamped = Math.max(0, Math.min(1, progress));
  if (!showEmpty && clamped === 0) return null;

  return (
    <View
      style={[{
        height,
        backgroundColor: "rgba(255, 255, 255, 0.16)",
        borderRadius: height / 2,
        overflow: "hidden",
      }, style]}
    >
      <View
        style={{
          width: `${clamped * 100}%` as unknown as number,
          height: "100%",
          borderRadius: height / 2,
          backgroundColor: tint,
        }}
      />
    </View>
  );
}

/** Re-export pour compat ancienne API (utilisé par certains composants). */
export const PROGRESS_ACCENT = colors.accent;
