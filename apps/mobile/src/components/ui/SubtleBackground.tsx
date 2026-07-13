import type { ReactNode } from "react";
import { View, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { useTheme, withAlpha } from "../../theme";

interface Props {
  children: ReactNode;
  style?: ViewStyle;
  /** Active un orbe violet subtle en haut (signature Tentacle). */
  ambient?: boolean;
}

/**
 * Fond racine du thème avec gradient vertical subtle vers s0Tint, et option
 * d'orbe violet ambient (signature) en haut. Pose les fondations cinematic
 * de chaque écran — noir profond en sombre, gris perle en clair.
 */
export function SubtleBackground({ children, style, ambient = false }: Props) {
  const theme = useTheme();
  const { surface, brand } = theme.colors;

  return (
    <View style={[{ flex: 1, backgroundColor: surface.s0 }, style]}>
      <LinearGradient
        colors={[surface.s0, surface.s0Tint]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      />
      {ambient && (
        <LinearGradient
          colors={[
            withAlpha(brand.violet, 0.18, brand.soft),
            withAlpha(brand.violet, 0.04, brand.soft),
            "transparent",
          ]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          locations={[0, 0.3, 0.7]}
          style={{ position: "absolute", top: 0, left: 0, right: 0, height: 320 }}
          pointerEvents="none"
        />
      )}
      {children}
    </View>
  );
}
