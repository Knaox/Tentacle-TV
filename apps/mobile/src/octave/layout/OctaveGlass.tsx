/**
 * Octave (mobile) — le VERRE du mode : le vrai Liquid Glass d'iOS 26
 * (`expo-glass-effect`) quand l'appareil l'a et que le réglage l'allume, sinon
 * le flou d'`expo-blur` sous un voile (Android, iOS d'avant) — la bascule est
 * celle de Tentacle (`GlassSurface`). Pour le chrome qui flotte (onglets,
 * en-têtes, mini-lecteur), jamais pour le contenu : pas de verre sur du verre.
 */

import { memo, type ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { GlassSurface } from "@/components/ui";

export interface OctaveGlassProps {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  /** Réponse tactile du verre natif (boutons, barres). */
  interactive?: boolean;
  /** `strong` (défaut) : lisible sur une pochette claire ; `panel` : fond d'un panneau. */
  tint?: "regular" | "strong" | "panel";
  bordered?: boolean;
}

export const OctaveGlass = memo(function OctaveGlass({ children, style, radius = 22, interactive, tint = "strong", bordered = true }: OctaveGlassProps) {
  return (
    <GlassSurface style={style} radius={radius} interactive={interactive} tint={tint} tier="overlay" bordered={bordered}>
      {children}
    </GlassSurface>
  );
});
