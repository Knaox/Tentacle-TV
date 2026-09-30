import { useEffect, useState } from "react";
import type { SharedValue } from "react-native-reanimated";
import { useFocusProgress } from "../../focus/useFocusProgress";

/**
 * 0 → 1 juste après le montage : l'apparition d'une surimpression (voile,
 * panneau). Une valeur partagée plutôt qu'une animation d'entrée (`entering`) :
 * montée en même temps que l'écran, celle-ci restait parfois figée à
 * mi-course — un voile à moitié posé laissait la grille briller au travers.
 * Réduire les animations la rend instantanée (`useFocusProgress`).
 */
export function useAppear(durationMs = 260): SharedValue<number> {
  const [shown, setShown] = useState(false);
  useEffect(() => setShown(true), []);
  return useFocusProgress(shown, durationMs);
}
