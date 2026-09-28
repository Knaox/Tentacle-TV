import { useState, useEffect, useCallback, type RefObject } from "react";

const CARD_MIN_WIDTH = 180;
/**
 * Sous ce palier (tablette, fenêtre étroite), la carte descend à 150 px : à
 * 180, une tablette de 820 px ne tenait que trois colonnes d'affiches géantes,
 * là où le téléphone en montre déjà trois. Au-dessus, rien ne change.
 */
const COMPACT_BELOW = 1100;
const CARD_MIN_WIDTH_COMPACT = 150;
const GAP = 16; // Tailwind gap-4

export function calcColumns(width: number): number {
  if (width <= 0) return 2;
  const min = width < COMPACT_BELOW ? CARD_MIN_WIDTH_COMPACT : CARD_MIN_WIDTH;
  return Math.max(2, Math.floor((width + GAP) / (min + GAP)));
}

export function useItemsPerRow(containerRef: RefObject<HTMLDivElement | null>) {
  const [itemsPerRow, setItemsPerRow] = useState(6);
  const [containerWidth, setContainerWidth] = useState(0);

  const update = useCallback((width: number) => {
    setContainerWidth(width);
    setItemsPerRow(calcColumns(width));
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    update(el.clientWidth);
    const ro = new ResizeObserver(([entry]) => {
      update(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [containerRef, update]);

  return { itemsPerRow, containerWidth };
}
