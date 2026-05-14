import type { ReactNode } from "react";
import { View, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SURFACE } from "../../theme";

interface Props {
  children: ReactNode;
  style?: ViewStyle;
  /** Active un orbe violet subtle en haut (signature Tentacle). */
  ambient?: boolean;
}

/**
 * Background pure black avec gradient vertical subtle vers s1, et option
 * d'orbe violet ambient (signature) en haut. Pose les fondations cinematic
 * de chaque écran.
 */
export function SubtleBackground({ children, style, ambient = false }: Props) {
  return (
    <View style={[{ flex: 1, backgroundColor: SURFACE.s0 }, style]}>
      <LinearGradient
        colors={[SURFACE.s0, "#070710"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      />
      {ambient && (
        <LinearGradient
          colors={["rgba(139, 92, 246, 0.18)", "rgba(139, 92, 246, 0.04)", "transparent"]}
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
