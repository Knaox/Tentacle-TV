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
  // Une teinte sombre par-dessus la matière : sur une image claire, le verre grisait et le texte pâlissait.
  const tint = <View style={[StyleSheet.absoluteFill, { backgroundColor: EB.glassTint }]} />;
  if (glass) {
    const { GlassView } = glass;
    return (
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: "hidden" }]}>
        <GlassView glassEffectStyle="regular" colorScheme="dark" style={StyleSheet.absoluteFill} />
        {tint}
      </View>
    );
  }
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: "hidden" }]}>
      <BlurView intensity={100} tint="systemChromeMaterialDark" style={StyleSheet.absoluteFill} />
      {tint}
    </View>
  );
}
