import { LinearGradient } from "expo-linear-gradient";
import type { IntroGradientProps, IntroPrimitives } from "@tentacle-tv/brand-intro-native";

type GradientColors = readonly [string, string, ...string[]];
type GradientLocations = readonly [number, number, ...number[]];

function Gradient({ colors, locations, ...rest }: IntroGradientProps) {
  // Les dégradés du logo ont toujours deux arrêts au moins (constantes générées).
  return <LinearGradient {...rest} colors={colors as unknown as GradientColors} locations={locations as unknown as GradientLocations} />;
}

/**
 * Les primitives du mobile pour la scène partagée de l'ouverture : le dégradé
 * d'Expo, et la découpe arrondie de React Native (par défaut) — en nouvelle
 * architecture, Android rogne bien les coins (l'Android TV, en ancienne, a sa
 * vue native).
 */
export const MOBILE_INTRO_PRIMITIVES: IntroPrimitives = { LinearGradient: Gradient };
