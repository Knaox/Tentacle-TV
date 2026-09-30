import { memo, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import Animated, { useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import { colors, scrim, white } from "../theme/tokens";
import { BrandGradient } from "./BrandGradient";

/**
 * La matière de la pilule de LECTURE : le dégradé de marque du bouton Lire du
 * bureau (`DetailPlayButton`), texte blanc. Une seule recette pour `PillButton`
 * et `CountdownPill` (variante `brand`).
 *
 * Au focus, elle S'ALLUME : au repos, un voile noir tient le dégradé un cran
 * plus profond ; focalisée, le voile s'efface, un reflet naît en haut, le
 * liseré s'éclaircit et la lueur de marque monte dessous. Jamais de voile
 * blanc sur toute la pilule : il la rendait pastel — éteinte au moment où
 * elle doit briller — et ramenait le blanc sur le rose sous 3:1 (2,96:1).
 * Ainsi le texte reste au moins à 3,3:1 sur le bout rose, focalisé ou non.
 *
 * `progress` : l'avancement du focus (0 → 1) ; seules des opacités s'animent.
 */
export const BrandPill = memo(function BrandPill({ progress, radius, children }: {
  progress: SharedValue<number>;
  radius: number;
  children: ReactNode;
}) {
  const glow = useAnimatedStyle(() => ({ opacity: GLOW_AT_REST + (1 - GLOW_AT_REST) * progress.value }));
  const veil = useAnimatedStyle(() => ({ opacity: 1 - progress.value }));
  const lit = useAnimatedStyle(() => ({ opacity: progress.value }));
  const round = { borderRadius: radius };
  return (
    <>
      <Animated.View style={[StyleSheet.absoluteFill, styles.glow, round, glow]} />
      <View style={[styles.body, round]}>
        <BrandGradient diagonal />
        <Animated.View style={[StyleSheet.absoluteFill, styles.veil, veil]} />
        <Animated.View style={[StyleSheet.absoluteFill, lit]}>
          <LinearGradient colors={SHEEN} locations={SHEEN_STOPS} style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, styles.rimLit, round]} />
        </Animated.View>
        <View style={[StyleSheet.absoluteFill, styles.rim, round]} />
        {children}
      </View>
    </>
  );
});

/** La lueur au repos : l'identité se devine, le focus la fait monter. */
const GLOW_AT_REST = 0.2;

/** Le reflet du focus : fort en haut, presque nul à mi-hauteur (le texte). */
const SHEEN = [white(0.24), white(0.05), white(0)];
const SHEEN_STOPS = [0, 0.48, 0.66];

const styles = StyleSheet.create({
  body: { overflow: "hidden" },
  // La lueur : l'ombre d'un calque caché derrière la pilule (une ombre iOS a
  // besoin d'un fond pour se dessiner).
  glow: {
    backgroundColor: colors.accent,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.7,
    shadowRadius: 22,
  },
  veil: { backgroundColor: scrim(0.05) },
  rim: { borderWidth: 1, borderColor: white(0.22) },
  rimLit: { borderWidth: 1.5, borderColor: white(0.42) },
});
