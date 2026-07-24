import { useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

export interface CardSpotlight {
  /** À poser sur la boîte image (celle qui porte la classe `card-spotlight`). */
  ref: React.RefObject<HTMLDivElement | null>;
  /** Valeur de l'attribut `data-lit` — pilote l'opacité du calque `::after`. */
  lit: boolean;
  /** Handlers pointeur à étaler sur la même boîte. */
  handlers: {
    onMouseMove: (e: React.MouseEvent) => void;
    onMouseEnter: () => void;
    onMouseLeave: () => void;
  };
}

/**
 * Halo de curseur sur une affiche : un dégradé radial (`--card-spotlight`)
 * dont le centre suit le pointeur via deux variables CSS, `--mx` / `--my`.
 *
 * Pourquoi des variables CSS et pas un state React : une rangée affiche une
 * dizaine de cartes, un `setState` par `mousemove` ferait re-rendre l'arbre à
 * 60 Hz. Ici React ne rend rien — on écrit deux propriétés sur le nœud, le
 * compositeur fait le reste.
 *
 * Neutralisé sous `prefers-reduced-motion` : `lit` reste faux, aucun listener
 * n'écrit quoi que ce soit, le calque garde son opacité 0.
 */
export function useCardSpotlight(): CardSpotlight {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const frame = useRef(0);
  const [lit, setLit] = useState(false);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (reduced) return;
      // Coordonnées LUES MAINTENANT, pas dans la rAF : l'événement peut avoir
      // été recyclé une frame plus tard, et `clientX` renverrait alors 0.
      const { clientX, clientY } = e;
      cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() => {
        const el = ref.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;
        el.style.setProperty("--mx", `${((clientX - r.left) / r.width) * 100}%`);
        el.style.setProperty("--my", `${((clientY - r.top) / r.height) * 100}%`);
      });
    },
    [reduced],
  );

  const onMouseEnter = useCallback(() => {
    if (!reduced) setLit(true);
  }, [reduced]);

  const onMouseLeave = useCallback(() => {
    cancelAnimationFrame(frame.current);
    setLit(false);
  }, []);

  return { ref, lit, handlers: { onMouseMove, onMouseEnter, onMouseLeave } };
}
