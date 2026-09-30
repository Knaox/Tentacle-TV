import { useEffect } from "react";
import { Easing, useReducedMotion, useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";
import { TV_STAGE } from "@tentacle-tv/theme";

/** La courbe du bureau (`--ease-out`). */
const EASE_OUT = Easing.bezier(0.22, 1, 0.36, 1);

/**
 * Une valeur qui va de 0 à 1 quand `on` devient vrai, et revient : c'est elle
 * qui porte l'agrandissement, le soulèvement et le reflet d'un élément
 * focalisé. Réduire les animations la rend instantanée.
 */
export function useFocusProgress(on: boolean, durationMs: number = TV_STAGE.focus.durationMs): SharedValue<number> {
  const reduced = useReducedMotion();
  const progress = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    progress.value = withTiming(on ? 1 : 0, { duration: reduced ? 0 : durationMs, easing: EASE_OUT });
  }, [on, reduced, durationMs, progress]);
  return progress;
}
