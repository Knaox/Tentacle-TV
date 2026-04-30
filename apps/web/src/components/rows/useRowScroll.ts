import { useState, useCallback, useRef, useEffect } from "react";

export interface RowScrollState {
  scrollRef: React.RefObject<HTMLDivElement | null>;
  canScrollLeft: boolean;
  canScrollRight: boolean;
  scrollByAmount: (direction: "left" | "right") => void;
  onScroll: () => void;
}

const SCROLL_AMOUNT_PX = 600;

export function useRowScroll(): RowScrollState {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const update = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 8);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 8);
  }, []);

  const scrollByAmount = useCallback(
    (direction: "left" | "right") => {
      const el = scrollRef.current;
      if (!el) return;
      const amount = Math.min(SCROLL_AMOUNT_PX, Math.floor(el.clientWidth * 0.85));
      el.scrollBy({ left: direction === "left" ? -amount : amount, behavior: "smooth" });
      setTimeout(update, 360);
    },
    [update],
  );

  useEffect(() => {
    update();
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [update]);

  return { scrollRef, canScrollLeft, canScrollRight, scrollByAmount, onScroll: update };
}
