import { memo, useCallback, useRef, useState } from "react";
import { StyleSheet } from "react-native";
import Animated, { runOnJS, useAnimatedReaction, useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import { TV_LIGHT } from "@tentacle-tv/theme";
import { SoftGradient } from "../background/SoftGradient";
import { white } from "../theme/tokens";

/**
 * L'HABIT du focus d'une carte (`CardFrame`) : le soulèvement (grande ombre,
 * ou lueur de l'œuvre), le reflet sur l'image, et le fondu de l'ombre de
 * repos d'une carte sans lueur. Au repos, tout cela vaut zéro — et n'existe
 * donc pas : monté au focus, gardé le temps du retour, démonté quand la
 * carte est revenue à sa place (`useFocusDressing`).
 *
 * Mesuré au profileur (bibliothèque de 1 200 titres) : chaque carte montait
 * ces trois calques avec leurs styles animés, au repos, pour rien — dans une
 * grille, c'est une bonne part de ce qui retenait le fil JS à chaque ligne
 * qui arrive. Le rendu, lui, est le même : mêmes calques, mêmes valeurs, au
 * focus comme au repos.
 */

const G = TV_LIGHT.cardGlow;

/** Vrai pendant le focus et le temps du retour ; `settle` démonte, une fois
 *  la carte revenue (seulement si le focus n'est pas revenu entre-temps). */
export function useFocusDressing(focused: boolean): [boolean, () => void] {
  const [dressed, setDressed] = useState(focused);
  if (focused && !dressed) setDressed(true);
  const focusedRef = useRef(focused);
  focusedRef.current = focused;
  const settle = useCallback(() => {
    if (!focusedRef.current) setDressed(false);
  }, []);
  return [dressed, settle];
}

export interface CardGlowStyle {
  color: string;
  opacity: number;
}

/**
 * Le soulèvement : la grande ombre noire, ou la lumière de l'œuvre (`glow`),
 * en fondu d'opacité (jamais une ombre animée). Il dit aussi quand la carte
 * est revenue (`onSettled`), focus parti.
 */
export const FocusRaised = memo(function FocusRaised({
  progress,
  glow,
  radius,
  focused,
  onSettled,
}: {
  progress: SharedValue<number>;
  glow?: CardGlowStyle;
  radius: number;
  focused: boolean;
  onSettled: () => void;
}) {
  const raised = useAnimatedStyle(() => ({ opacity: progress.value }));
  useAnimatedReaction(
    () => progress.value < 0.002,
    (rested, previous) => {
      if (!focused && rested && previous !== true) runOnJS(onSettled)();
    },
    [focused, onSettled],
  );
  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        glow ? [dressingStyles.glowRaised, { shadowColor: glow.color, shadowOpacity: glow.opacity }] : dressingStyles.shadowRaised,
        { borderRadius: radius },
        raised,
      ]}
    />
  );
});

/** Le reflet spéculaire, en travers de l'image (dans le cadre qui rogne). */
export const FocusSheen = memo(function FocusSheen({ progress, width, height }: { progress: SharedValue<number>; width: number; height: number }) {
  const sheen = useAnimatedStyle(() => ({ opacity: 0.9 * progress.value }));
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, sheen]}>
      <SoftGradient
        width={width}
        height={height}
        colors={[white(0.26), white(0.06), white(0)]}
        locations={[0, 0.35, 0.6]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.9, y: 1 }}
      />
    </Animated.View>
  );
});

/** L'ombre de repos d'une carte SANS lueur, qui s'efface quand elle se soulève. */
export const FadingRestShadow = memo(function FadingRestShadow({ progress, radius }: { progress: SharedValue<number>; radius: number }) {
  const rest = useAnimatedStyle(() => ({ opacity: 1 - progress.value }));
  return <Animated.View style={[StyleSheet.absoluteFill, dressingStyles.shadowRest, { borderRadius: radius }, rest]} />;
});

export const dressingStyles = StyleSheet.create({
  shadowRest: {
    backgroundColor: "#000",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
  },
  glowRaised: {
    backgroundColor: "#000",
    shadowOffset: { width: 0, height: G.offsetY },
    shadowRadius: G.radius,
  },
  shadowRaised: {
    backgroundColor: "#000",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 28 },
    shadowOpacity: 0.65,
    shadowRadius: 30,
  },
});
