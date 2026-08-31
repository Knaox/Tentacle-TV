import { View, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { progressGradient, useTheme } from "../../theme";

interface Props {
  progress: number; // 0-1
  height?: number;
  style?: ViewStyle;
  /** Couleur de remplissage UNIE. Absente = dégradé de marque violet → rose. */
  tint?: string;
  /** Affiche même quand progress = 0 (utile pour squelettes). */
  showEmpty?: boolean;
}

/**
 * Barre de progression fine — Netflix-style. Default 3px, piste translucide
 * (border.strong = 16% exact historique). Le remplissage par défaut est le
 * dégradé de marque violet → rose (`--progress-fill` du desktop) ; `tint`
 * garde la possibilité d'un aplat.
 */
export function ProgressBar({ progress, height = 3, style, tint, showEmpty = false }: Props) {
  const theme = useTheme();
  const clamped = Math.max(0, Math.min(1, progress));
  if (!showEmpty && clamped === 0) return null;

  const fillStyle = {
    width: `${clamped * 100}%` as unknown as number,
    height: "100%" as const,
    borderRadius: height / 2,
  };
  const gradient = progressGradient(theme.colors.brand);

  return (
    <View
      style={[{
        height,
        backgroundColor: theme.colors.border.strong,
        borderRadius: height / 2,
        overflow: "hidden",
      }, style]}
    >
      {tint ? (
        <View style={[fillStyle, { backgroundColor: tint }]} />
      ) : (
        <LinearGradient
          colors={gradient.colors}
          start={gradient.start}
          end={gradient.end}
          style={fillStyle}
        />
      )}
    </View>
  );
}
