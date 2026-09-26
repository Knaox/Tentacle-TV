import { useEffect, useState } from "react";

/**
 * Faux au premier rendu, vrai à l'image suivante : de quoi faire jouer une
 * transition d'ENTRÉE (opacité, transform) à un élément qui vient de se monter
 * — le `Animated.timing` de montage de l'app. Sous « animations réduites », la
 * classe `motion-reduce:transition-none` de l'élément rend le saut instantané.
 */
export function useEntered(): boolean {
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    let inner = 0;
    const outer = requestAnimationFrame(() => { inner = requestAnimationFrame(() => setEntered(true)); });
    return () => { cancelAnimationFrame(outer); cancelAnimationFrame(inner); };
  }, []);
  return entered;
}
