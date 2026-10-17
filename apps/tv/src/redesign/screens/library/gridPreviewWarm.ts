import { useCallback, useEffect, useRef } from "react";
import { gridTrailerPreviewWarmWindow } from "@tentacle-tv/tv-core";
import type { CardModel } from "../../cards/cardTypes";
import { useCardPreviewWarm } from "../../cards/trailerPreviewPort";
import type { GridMotion } from "./gridMotion";

/**
 * La préparation des aperçus autour du focus d'une grille : sa ligne et la
 * suivante (tv-core `gridTrailerPreviewWarmWindow`), qui REMPLACENT ce qui
 * attend encore. Elle part quand la grille se POSE (`gridMotion`) : ni pendant
 * un défilement, même quand tvOS ne prévient plus l'app de ses focus (flèche
 * tenue). Rend ce que la grille appelle à chaque focus. Les cartes se lisent
 * par référence : une page de plus ne change pas le gestionnaire.
 */
export function useGridPreviewWarm(cards: readonly CardModel[], columns: number, motion: GridMotion): (index: number) => void {
  const warm = useCardPreviewWarm();
  const latest = useRef(cards);
  latest.current = cards;
  const pending = useRef<number | null>(null);
  useEffect(() => {
    if (!warm) return undefined;
    return motion.onSettled(() => {
      const index = pending.current;
      if (index === null) return;
      pending.current = null;
      const list = latest.current;
      const [start, end] = gridTrailerPreviewWarmWindow(index, list.length, columns);
      warm(list.slice(start, end), { replace: true });
    });
  }, [warm, columns, motion]);
  return useCallback(
    (index: number) => {
      pending.current = index;
      motion.focused();
    },
    [motion],
  );
}
