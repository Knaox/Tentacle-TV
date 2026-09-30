import { memo, type ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import { colors, white } from "../theme/tokens";
import { useGlassRendering } from "./liquidGlassMode";
import { NativeGlassView } from "./nativeGlass";

/**
 * LA surface de verre de la refonte — une seule brique, un contrat stable.
 *
 * - Liquid Glass demandé, tvOS 26 : le verre NATIF (`UIGlassEffect`, vue
 *   `TentacleGlassView`) en couche de fond — il réfracte et floute ce qui est
 *   derrière, son bord et son reflet sont ceux du système.
 * - Liquid Glass demandé, système plus ancien : le verre CLAIR des maquettes
 *   tvOS 26, simulé — un voile blanc très léger qui laisse passer les halos
 *   de l'œuvre, un reflet spéculaire en haut, un bord allumé.
 * - Liquid Glass coupé : le verre ENRICHI du bureau (`--glass-tint`) — plus
 *   dense, liseré, reflet. Jamais une surface opaque nue.
 *
 * `tone` règle la densité : `regular` (navigation, panneaux), `strong`
 * (feuilles, menus lus longtemps), `clear` (boutons posés sur une image).
 *
 * Le verre natif, mesuré au banc (`docs/TV-REFONTE.md`, « Le verre natif ») :
 * rien à l'arrêt, rien sous une opacité 0, un fondu de parent qui passe sans
 * saut ; il se paie quand ce qu'il couvre BOUGE — environ deux fois et demie la
 * simulation au pire cas (une image qui glisse sous six verres).
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
  const rendering = useGlassRendering();
  return (
    <View style={[{ borderRadius: radius }, elevated && styles.elevated, style]}>
      {rendering === "native" && NativeGlassView ? (
        <NativeGlassView radius={radius} tone={tone} style={StyleSheet.absoluteFill} />
      ) : (
        <SimulatedGlass radius={radius} tone={tone} liquid={rendering === "simulated"} />
      )}
      {children}
    </View>
  );
});

/** Le verre dessiné : un voile, un reflet, un bord — pour tvOS < 26 et le
 *  verre enrichi. */
function SimulatedGlass({ radius, tone, liquid }: { radius: number; tone: GlassTone; liquid: boolean }) {
  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        { borderRadius: radius, backgroundColor: (liquid ? LIQUID_FILL : ENRICHED_FILL)[tone] },
        styles.clip,
      ]}
    >
      {/* Le reflet : une lumière venue d'en haut, éteinte avant la mi-hauteur —
          verticale, pour ne pas tracer de diagonale sur un grand panneau. */}
      <LinearGradient
        colors={[white(liquid ? 0.16 : 0.08), white(0)]}
        locations={[0, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.42 }}
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
  );
}

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
