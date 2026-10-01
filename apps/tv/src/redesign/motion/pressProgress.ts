import { createContext, useContext } from "react";
import type { SharedValue } from "react-native-reanimated";
import { TV_MOTION } from "@tentacle-tv/theme";

/**
 * L'APPUI d'Apple TV : OK enfoncé, l'élément focalisé s'enfonce d'un cran ;
 * relâché, il remonte avec un soupçon de rebond (préréglage `press`). La
 * valeur (0 → 1 tant qu'OK est enfoncé) est tenue par `FocusTarget`, sur le
 * fil d'interface ; ce qu'il rend la lit ici (`usePressProgress`) — une carte,
 * dont l'image est sœur de sa cible, la reçoit par `pressProgress`.
 */

export const PressProgressContext = createContext<SharedValue<number> | null>(null);

/** L'appui de l'élément focalisable qui contient la vue ; null hors de lui. */
export function usePressProgress(): SharedValue<number> | null {
  return useContext(PressProgressContext);
}

/** L'échelle de l'appui : 1 au repos, `TV_MOTION.press.scale` enfoncé. */
export function pressScale(press: number): number {
  "worklet";
  return 1 - (1 - TV_MOTION.press.scale) * press;
}
