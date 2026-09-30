import { memo, type ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import { colors, white } from "../theme/tokens";
import { useLiquidGlassEnabled } from "./liquidGlassMode";

/**
 * LA surface de verre de la refonte — une seule brique, un contrat stable.
 *
 * - Liquid Glass demandé : le verre CLAIR des maquettes tvOS 26 — un voile
 *   blanc très léger qui laisse passer les halos de l'œuvre, un reflet
 *   spéculaire en haut, un bord allumé. Quand le module natif existera
 *   (UIGlassEffect sur tvOS 26), c'est ici, et seulement ici, qu'il se
 *   branchera ; le reste des vues ne changera pas.
 * - Liquid Glass coupé : le verre ENRICHI du bureau (`--glass-tint`) — plus
 *   dense, liseré, reflet. Jamais une surface opaque nue.
 *
 * `tone` règle la densité : `regular` (navigation, panneaux), `strong`
 * (feuilles, menus lus longtemps), `clear` (boutons posés sur une image).
 */

export type GlassTone = "regular" | "strong" | "clear";

export interface GlassSurfaceProps {
  radius: number;
  tone?: GlassTone;
  /** Ombre portée (0 24 60 noir 0,45). */
  elevated?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}

const LIQUID_FILL: Record<GlassTone, string> = {
  regular: white(0.07),
  strong: white(0.1),
  clear: white(0.16),
};

const ENRICHED_FILL: Record<GlassTone, string> = {
  regular: colors.glassTint,
  strong: colors.glassTintStrong,
  clear: white(0.14),
};

export const GlassSurface = memo(function GlassSurface({
  radius,
  tone = "regular",
  elevated = false,
  style,
  children,
}: GlassSurfaceProps) {
  const liquid = useLiquidGlassEnabled();
  return (
    <View style={[{ borderRadius: radius }, elevated && styles.elevated, style]}>
      <View
        style={[
          StyleSheet.absoluteFill,
          { borderRadius: radius, backgroundColor: (liquid ? LIQUID_FILL : ENRICHED_FILL)[tone] },
          styles.clip,
        ]}
      >
        {/* Le reflet : une lumière venue d'en haut à gauche, éteinte à mi-hauteur. */}
        <LinearGradient
          colors={[white(liquid ? 0.2 : 0.1), white(0)]}
          locations={[0, 0.7]}
          start={{ x: 0.25, y: 0 }}
          end={{ x: 0.45, y: 0.62 }}
          style={StyleSheet.absoluteFill}
        />
        {/* Le bord : allumé en haut, discret ailleurs. */}
        <View
          style={[
            StyleSheet.absoluteFill,
            { borderRadius: radius, borderWidth: 1, borderColor: white(liquid ? 0.14 : 0.12) },
          ]}
        />
        <View style={[styles.rim, { left: radius * 0.7, right: radius * 0.7, backgroundColor: white(liquid ? 0.42 : 0.24) }]} />
      </View>
      {children}
    </View>
  );
});

const styles = StyleSheet.create({
  clip: { overflow: "hidden" },
  elevated: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.45,
    shadowRadius: 30,
  },
  rim: { position: "absolute", top: 0, height: 1 },
});
