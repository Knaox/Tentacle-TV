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
 * L'entrée seulement : à la fermeture, elle se retire aussitôt — un
 * focalisable qui survivrait le temps d'une sortie disputerait le focus à ce
 * qui le reprend (et ses guides le retiendraient).
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
