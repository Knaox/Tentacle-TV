import type { SharedValue } from "react-native-reanimated";
import type { Motion } from "../motion/motion";
import { useMotion } from "../motion/useMotion";

/**
 * Une valeur qui va de 0 à 1 quand `on` devient vrai, et revient : c'est elle
 * qui porte l'agrandissement, le soulèvement et le reflet d'un élément
 * focalisé.
 *
 * Par défaut, le mouvement du FOCUS d'Apple TV (`motion/motion.ts`) : un
 * ressort vif à l'arrivée — 75 % en 100 ms, un dépassement invisible —, un
 * retour bref et doux ; un focus qui revient en cours de route repart avec sa
 * vitesse. Un autre préréglage (`recede`, `reveal`…) pour ce qui n'est pas le
 * focus, ou une durée : une sortie douce dans les deux sens (un interrupteur).
 * Réduire les animations la rend instantanée ; hors Apple TV aussi.
 */
export function useFocusProgress(on: boolean, motion: Motion = "focus"): SharedValue<number> {
  return useMotion(on, motion);
}
