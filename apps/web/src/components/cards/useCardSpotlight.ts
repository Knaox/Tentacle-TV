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
/** Au-delà, on relit la géométrie : filet contre un défilement pendant le survol. */
const RECT_TTL_MS = 250;

export function useCardSpotlight(): CardSpotlight {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const frame = useRef(0);
  const rect = useRef<DOMRect | null>(null);
  const rectAt = useRef(0);
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
        // Géométrie mise en cache. La relire à chaque image forçait un calcul
        // de mise en page SYNCHRONE, et au pire moment : dans la rAF, donc
        // après que le rendu React du survol a invalidé le style. Or une carte
        // ne bouge pas sous le curseur pendant qu'on la survole.
        const now = performance.now();
        if (!rect.current || now - rectAt.current > RECT_TTL_MS) {
          rect.current = el.getBoundingClientRect();
          rectAt.current = now;
        }
        const r = rect.current;
        if (r.width === 0 || r.height === 0) return;
        // En PIXELS, plus en pourcentage : le calque est désormais une boîte de
        // taille fixe déplacée par `transform`, et non un dégradé recentré à
        // chaque image (cf. `--card-spotlight` dans surfaces.css). Un
        // pourcentage s'y rapporterait à la boîte du halo, pas à la carte.
        el.style.setProperty("--mx", `${clientX - r.left}px`);
        el.style.setProperty("--my", `${clientY - r.top}px`);
      });
    },
    [reduced],
  );

  const onMouseEnter = useCallback(() => {
    rect.current = null; // la carte a pu bouger depuis le dernier survol
    if (!reduced) setLit(true);
  }, [reduced]);

  const onMouseLeave = useCallback(() => {
    cancelAnimationFrame(frame.current);
    rect.current = null;
    setLit(false);
  }, []);

  return { ref, lit, handlers: { onMouseMove, onMouseEnter, onMouseLeave } };
}
