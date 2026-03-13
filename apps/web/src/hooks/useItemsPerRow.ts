import { useState, useEffect, useCallback, type RefObject } from "react";

const CARD_MIN_WIDTH = 180;
const GAP = 16; // Tailwind gap-4

function calcColumns(width: number): number {
  if (width <= 0) return 2;
  return Math.max(2, Math.floor((width + GAP) / (CARD_MIN_WIDTH + GAP)));
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
