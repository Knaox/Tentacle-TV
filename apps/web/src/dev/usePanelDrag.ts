/**
 * Déplacement du panneau de diagnostic à la souris.
 *
 * Écrit à la main plutôt qu'avec une bibliothèque : c'est un outil de
 * développement, il ne doit rien peser dans les dépendances du produit.
 *
 * Les écouteurs vivent sur `window` et non sur le panneau : une souris qui
 * sort du panneau pendant le glisser doit continuer à le déplacer, sinon il
 * « décroche » dès qu'on va vite.
 */

import { useCallback, useEffect, useRef, useState } from "react";

export interface Position {
  x: number;
  y: number;
}

const MARGE = 8;

/** Garde le panneau dans la fenêtre, même après un redimensionnement. */
function contenir(p: Position, largeur: number, hauteur: number): Position {
  return {
    x: Math.min(Math.max(p.x, MARGE), Math.max(MARGE, innerWidth - largeur - MARGE)),
    y: Math.min(Math.max(p.y, MARGE), Math.max(MARGE, innerHeight - hauteur - MARGE)),
  };
}

export function usePanelDrag(initial: Position) {
  const [position, setPosition] = useState<Position>(initial);
  const element = useRef<HTMLDivElement | null>(null);
  const depart = useRef<{ souris: Position; panneau: Position } | null>(null);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Un clic sur un bouton du panneau ne doit pas le déplacer.
      if ((e.target as HTMLElement).closest("button")) return;
      depart.current = { souris: { x: e.clientX, y: e.clientY }, panneau: position };
    },
    [position],
  );

  useEffect(() => {
    const bouger = (e: PointerEvent): void => {
      const d = depart.current;
      if (!d) return;
      const brut = {
        x: d.panneau.x + (e.clientX - d.souris.x),
        y: d.panneau.y + (e.clientY - d.souris.y),
      };
      const el = element.current;
      setPosition(contenir(brut, el?.offsetWidth ?? 0, el?.offsetHeight ?? 0));
    };
    const lacher = (): void => {
      depart.current = null;
    };
    addEventListener("pointermove", bouger);
    addEventListener("pointerup", lacher);
    return () => {
      removeEventListener("pointermove", bouger);
      removeEventListener("pointerup", lacher);
    };
  }, []);

  // Un panneau laissé hors écran après un redimensionnement serait
  // irrécupérable : on le ramène.
  useEffect(() => {
    const ajuster = (): void => {
      const el = element.current;
      setPosition((p) => contenir(p, el?.offsetWidth ?? 0, el?.offsetHeight ?? 0));
    };
    addEventListener("resize", ajuster);
    return () => removeEventListener("resize", ajuster);
  }, []);

  return { position, element, onPointerDown };
}
