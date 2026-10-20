import { memo } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";

import { useThemeMode } from "../../../theme/appThemeContext";
import { getLiquidGlassModule } from "../../../theme/liquidGlass";

/**
 * La matière d'un bouton posé sur une IMAGE (lecteur, affiche, héros).
 *
 * - iOS 26 + préférence Liquid Glass : le verre natif d'Apple
 *   (`expo-glass-effect`), en schéma SOMBRE (l'image dessous ne suit pas le
 *   thème), réactif au toucher.
 * - iOS d'avant : flou natif + voile sombre + liseré clair d'un cheveu.
 * - Android : un voile sombre PLEIN, sans flou (Material ne fait pas de
 *   verre, et le flou y coûte une passe de rendu).
 *
 * Coût GPU : la matière n'existe que si le bouton est MONTÉ. Un bouton masqué
 * (contrôles du lecteur au repos) se démonte, jamais `opacity: 0` sous un
 * verre (règle « ce qui n'est pas affiché ne consomme rien »).
 */
export const GlassFill = memo(function GlassFill({ radius, interactive = true }: { radius: number; interactive?: boolean }) {
  const { liquidGlass } = useThemeMode();
  if (Platform.OS === "android") {
    return <View pointerEvents="none" style={[StyleSheet.absoluteFill, st.android, { borderRadius: radius }]} />;
  }
  const mod = liquidGlass.enabled ? getLiquidGlassModule() : null;
  if (mod) {
    const { GlassView } = mod;
    return (
      <GlassView
        pointerEvents="none"
        glassEffectStyle="regular"
        colorScheme="dark"
        isInteractive={interactive}
        style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: "hidden" }]}
      />
    );
  }
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, st.blurClip, { borderRadius: radius }]}>
      <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, st.veil]} />
    </View>
  );
});

const st = StyleSheet.create({
  android: {
    backgroundColor: "rgba(16, 16, 22, 0.62)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255, 255, 255, 0.14)",
  },
  blurClip: {
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255, 255, 255, 0.22)",
  },
  veil: { backgroundColor: "rgba(0, 0, 0, 0.22)" },
});
