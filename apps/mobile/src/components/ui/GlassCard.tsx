import { type ReactNode } from "react";
import { View, StyleSheet, type ViewStyle } from "react-native";

import { spacing, SHADOW_RN } from "../../theme";
import { GlassSurface } from "./GlassSurface";

interface Props {
  children: ReactNode;
  style?: ViewStyle;
  noPadding?: boolean;
}

/**
 * Vraie carte glass — réécrite sur GlassSurface (voile thémé light/dark +
 * BlurView + border hairline ; futur point de bascule Liquid Glass).
 * API historique conservée : children / style / noPadding.
 * intensity=40 : valeur pixel-perfect historique de la carte.
 */
export function GlassCard({ children, style, noPadding }: Props) {
  return (
    // elevated (clair) : ombre douce pour détacher la carte du fond nacré.
    // Réservé au cas padding (taille de contenu) ; noPadding = fill/flex → off.
    <GlassSurface intensity={40} elevated={!noPadding} style={[SHADOW_RN.elev2 as ViewStyle, style]}>
      {/* noPadding consumers (e.g. Disclaimer) embed a `flex: 1` ScrollView that
       *  needs a sized parent — without `flex: 1` here, the ScrollView collapses
       *  to 0px height and the legal text becomes invisible. */}
      <View style={noPadding ? styles.fill : { padding: spacing.lg }}>{children}</View>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
