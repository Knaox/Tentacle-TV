import { View, type ViewStyle } from "react-native";

import { useTheme } from "../../theme";

interface Props {
  progress: number; // 0-1
  height?: number;
  style?: ViewStyle;
  /** Couleur de remplissage. Default = violet brand du thème. */
  tint?: string;
  /** Affiche même quand progress = 0 (utile pour squelettes). */
  showEmpty?: boolean;
}

/**
 * Barre de progression fine — Netflix-style. Default 3px, piste translucide
 * (border.strong = 16% exact historique), remplissage violet brand.
 */
export function ProgressBar({ progress, height = 3, style, tint, showEmpty = false }: Props) {
  const theme = useTheme();
  const clamped = Math.max(0, Math.min(1, progress));
  if (!showEmpty && clamped === 0) return null;

  return (
    <View
      style={[{
        height,
        backgroundColor: theme.colors.border.strong,
        borderRadius: height / 2,
        overflow: "hidden",
      }, style]}
    >
      <View
        style={{
          width: `${clamped * 100}%` as unknown as number,
          height: "100%",
          borderRadius: height / 2,
          backgroundColor: tint ?? theme.colors.brand.violet,
        }}
      />
    </View>
  );
}
