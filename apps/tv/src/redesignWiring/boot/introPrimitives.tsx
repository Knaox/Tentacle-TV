import LinearGradient from "react-native-linear-gradient";
import type { IntroGradientProps, IntroPrimitives } from "@tentacle-tv/brand-intro-native";
import { RoundClip } from "../../redesign/render/RoundClip";

function Gradient(props: IntroGradientProps) {
  return <LinearGradient {...props} />;
}

/**
 * Les primitives de la TV pour la scène partagée de l'ouverture : son dégradé
 * linéaire et sa découpe arrondie (sur Android TV, la vue native
 * `TentacleRoundClip` : l'ancienne architecture rognait en rectangle).
 */
export const TV_INTRO_PRIMITIVES: IntroPrimitives = { LinearGradient: Gradient, RoundClip };
