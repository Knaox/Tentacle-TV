/**
 * Octave — la géométrie des grilles de cartes, partagée par la grille, les
 * étagères d'une rangée et leurs squelettes (la même largeur de carte partout :
 * le squelette tient EXACTEMENT la place du contenu).
 */

import { useLayoutEffect, useState, type RefObject } from "react";

/** La largeur minimale d'une carte (px) et l'écart entre deux cartes (px). */
export const CARD_MIN_PX = 160;
export const CARD_GAP_PX = 4;

/** La grille : autant de colonnes que la colonne de contenu en tient (`minmax(10rem, 1fr)`, `gap-1`). */
export const CARD_GRID_CLASS = "grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-1";

/** Le nombre de colonnes qu'une largeur tient — la règle même de `auto-fill`. */
export function columnsFor(width: number, minPx = CARD_MIN_PX, gapPx = CARD_GAP_PX): number {
  if (!(width > 0)) return 0;
  return Math.max(1, Math.floor((width + gapPx) / (minPx + gapPx)));
}

/**
 * Le nombre de colonnes de la grille posée dans `ref`, mesuré AVANT la première
 * peinture puis suivi (barre latérale, file ouverte, fenêtre). 0 avant la mesure.
 */
export function useGridColumns(ref: RefObject<HTMLElement | null>, minPx = CARD_MIN_PX, gapPx = CARD_GAP_PX): number {
  const [columns, setColumns] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      // La largeur de CONTENU (sans le rembourrage) : celle que la grille partage entre ses colonnes.
      const style = getComputedStyle(el);
      const inner = el.clientWidth - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0);
      setColumns(columnsFor(inner, minPx, gapPx));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, minPx, gapPx]);
  return columns;
}
