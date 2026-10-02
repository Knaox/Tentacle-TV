import { useAnimatedStyle } from "react-native-reanimated";
import type { Motion } from "./motion";
import { useEntrance } from "./useMotion";
import { SWAP_FLOOR } from "./useSwap";

/**
 * L'ARRIVÉE d'une surimpression qui porte du focus (un panneau du lecteur, la
 * carte « À suivre », l'écran de fin) : à son montage, son voile entre en
 * fondu (`veil`) et son corps glisse de `distance` points sur `axis` en
 * entrant en fondu (`body`) — jamais tout à fait transparent (`SWAP_FLOOR`) :
 * tvOS y pose son focus dès l'ouverture.
 *
 * L'entrée seulement. La sortie est à qui monte la surimpression : un panneau
 * du lecteur reste monté le temps de son fondu, focus compris, et ne le rend
 * qu'à la fin (`useExit`, `PlayerChromeView`) — rendu plus tôt, un focalisable
 * encore à l'écran changeait d'aspect sous les yeux ; la carte « À suivre » et
 * l'écran de fin se retirent aussitôt.
 */
export function useOverlayArrival(axis: "x" | "y", distance: number, motion: Motion = "panel") {
  const p = useEntrance(motion);
  const veil = useAnimatedStyle(() => ({ opacity: Math.min(1, p.value) }));
  const body = useAnimatedStyle(() => {
    const shift = distance * (1 - p.value);
    return {
      opacity: Math.max(SWAP_FLOOR, Math.min(1, p.value)),
      transform: axis === "x" ? [{ translateX: shift }] : [{ translateY: shift }],
    };
  });
  return { veil, body };
}
