import { useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

export interface CardSpotlight {
  /** À poser sur la boîte image (celle qui porte la classe `card-spotlight`). */
  ref: React.RefObject<HTMLDivElement | null>;
  /** À poser sur le calque `.card-glow` — c'est LUI qu'on déplace. */
  glowRef: React.RefObject<HTMLDivElement | null>;
  /** Valeur de l'attribut `data-lit` — pilote l'opacité du calque. */
  lit: boolean;
  /** Handlers pointeur à étaler sur la boîte image. */
  handlers: {
    onMouseMove: (e: React.MouseEvent) => void;
    onMouseEnter: () => void;
    onMouseLeave: () => void;
  };
}

/**
 * Halo de curseur sur une affiche : un dégradé radial qui suit le pointeur.
 *
 * Pas de state React : une rangée affiche une dizaine de cartes, un `setState`
 * par `mousemove` ferait re-rendre l'arbre à 60 Hz. React ne rend rien ici.
 *
 * Et pas de variable CSS non plus, ce qui est le point le moins évident. Les
 * propriétés personnalisées sont HÉRITÉES : les écrire sur la boîte image
 * obligeait le moteur à invalider le style calculé de tout son sous-arbre —
 * affiche, voile, pastilles, grain — soixante fois par seconde. Un recalcul de
 * style sur le thread principal, invisible dans un profil de peinture.
 *
 * On écrit donc `transform` DIRECTEMENT sur le calque, qui est une feuille
 * sans descendant : l'invalidation ne peut plus se propager nulle part, et le
 * déplacement reste une simple translation de compositeur.
 *
 * Neutralisé sous `prefers-reduced-motion` : `lit` reste faux, aucun listener
 * n'écrit quoi que ce soit, le calque garde son opacité 0.
 */
/** Au-delà, on relit la géométrie : filet contre un défilement pendant le survol. */
const RECT_TTL_MS = 250;

export function useCardSpotlight(): CardSpotlight {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
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
        const glow = glowRef.current;
        if (!el || !glow) return;
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
        // Écrit sur le calque lui-même, jamais sur la boîte image : le calque
        // n'a aucun descendant, donc rien à réinvalider en cascade.
        glow.style.transform =
          `translate3d(${clientX - r.left}px, ${clientY - r.top}px, 0)`;
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

  return { ref, glowRef, lit, handlers: { onMouseMove, onMouseEnter, onMouseLeave } };
}
