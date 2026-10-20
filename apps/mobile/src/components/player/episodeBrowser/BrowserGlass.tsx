import { Platform, StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import { useThemeMode } from "../../../theme/appThemeContext";
import { getLiquidGlassModule } from "../../../theme/liquidGlass";
import { EB } from "./browserTokens";

/**
 * La matière d'une plaque de la liste des épisodes : le Liquid Glass d'iOS 26
 * quand il est allumé, sinon le matériau des menus d'iOS ; un fond plein sur
 * Android (Material ne fait pas de verre). Montée seulement quand la plaque
 * est AFFICHÉE — jamais un verre caché par l'opacité.
 */
export function BrowserGlass({ radius, solid = false }: { radius: number; solid?: boolean }) {
  const { liquidGlass } = useThemeMode();
  if (solid || Platform.OS === "android") {
    return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: radius, backgroundColor: solid ? EB.sheet : EB.androidSurface }]} />;
  }
  const glass = liquidGlass.enabled ? getLiquidGlassModule() : null;
  if (glass) {
    const { GlassView } = glass;
    return (
      <GlassView
        pointerEvents="none"
        glassEffectStyle="regular"
        colorScheme="dark"
        style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: "hidden" }]}
      />
    );
  }
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: "hidden" }]}>
      <BlurView intensity={100} tint="systemChromeMaterialDark" style={StyleSheet.absoluteFill} />
    </View>
  );
}
