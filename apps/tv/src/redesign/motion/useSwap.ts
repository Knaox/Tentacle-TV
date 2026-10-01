import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { runOnJS, useReducedMotion, useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";
import { EASE, MOTION_ENABLED } from "./motion";

/**
 * L'échange d'un contenu UNIQUE qui ne se dédouble pas (le texte et les
 * boutons du héros : deux copies feraient deux jeux de focalisables) : il
 * SORT (`outMs`, courbe d'accélération), change pendant qu'il est invisible,
 * puis ENTRE (`inMs`, sortie douce). Un changement qui arrive pendant la
 * sortie la rejoint ; pendant l'entrée, il repart d'où elle en est. Rien
 * d'autre ne bouge : `progress` (1 = affiché) se lit dans un
 * `useAnimatedStyle`, sur le fil d'interface.
 *
 * La sortie s'arrête à `SWAP_FLOOR`, invisible mais pas nulle : à une opacité
 * nulle, tvOS tient pour caché un élément focalisé qu'elle contiendrait, et
 * recalcule tout son focus (mesuré au banc : un tiers du fil principal
 * pendant la rotation du héros).
 */

/** L'opacité de fin de sortie : à l'œil, rien ; pour tvOS, encore là. */
export const SWAP_FLOOR = 0.02;
export function useSwap<T>(key: string, item: T, outMs: number, inMs: number): { shown: T; progress: SharedValue<number> } {
  const reduced = useReducedMotion();
  const instant = reduced || !MOTION_ENABLED;
  const [shown, setShown] = useState<{ key: string; item: T }>({ key, item });
  const progress = useSharedValue(1);
  const latest = useRef({ key, item });
  latest.current = { key, item };
  const leaving = useRef(false);

  const swap = useCallback(() => {
    leaving.current = false;
    setShown(latest.current);
  }, []);

  useLayoutEffect(() => {
    if (key === shown.key) {
      // Le même contenu mis à jour : sur place, sans échange.
      if (item !== shown.item) setShown({ key, item });
      return;
    }
    if (leaving.current) return;
    if (instant) {
      setShown({ key, item });
      return;
    }
    leaving.current = true;
    progress.value = withTiming(SWAP_FLOOR, { duration: outMs, easing: EASE.in }, (finished) => {
      "worklet";
      if (finished) runOnJS(swap)();
    });
  }, [key, item, shown, instant, outMs, progress, swap]);

  // Le nouveau contenu est rendu (invisible) : il entre.
  const firstKey = useRef(shown.key);
  useLayoutEffect(() => {
    if (shown.key === firstKey.current) return;
    firstKey.current = shown.key;
    progress.value = instant ? 1 : withTiming(1, { duration: inMs, easing: EASE.out });
  }, [shown.key, instant, inMs, progress]);

  return { shown: shown.item, progress };
}
