import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

export interface HorizontalScrollControls {
  ref: RefObject<HTMLDivElement | null>;
  canLeft: boolean;
  canRight: boolean;
  scrollBy: (direction: "left" | "right") => void;
}

const EDGE_EPSILON = 4;

/**
 * Drives a horizontally scrollable strip with multi-input support:
 *  - Vertical wheel → horizontal scroll (Windows mouse users).
 *  - Click-and-drag with the pointer (no trackpad needed).
 *  - Tracks `canLeft`/`canRight` so the consumer can render chevron buttons.
 *  - `scrollBy(direction)` does a smooth ~85% viewport step.
 * Safe no-op when the content fits.
 */
export function useHorizontalScroll(): HorizontalScrollControls {
  const ref = useRef<HTMLDivElement | null>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const updateEdges = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > EDGE_EPSILON);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - EDGE_EPSILON);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    updateEdges();

    const onWheel = (e: WheelEvent) => {
      if (e.deltaY === 0) return;
      if (el.scrollWidth <= el.clientWidth) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener("wheel", onWheel, { passive: false });

    const onScroll = () => updateEdges();
    el.addEventListener("scroll", onScroll, { passive: true });

    const ro = new ResizeObserver(updateEdges);
    ro.observe(el);

    // Pointer drag-to-scroll (desktop mouse users without wheel).
    let dragStartX = 0;
    let dragStartScrollLeft = 0;
    let dragActive = false;
    const onPointerDown = (e: PointerEvent) => {
      // Only react to primary mouse button — leave touch/pen to native scroll.
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      dragStartX = e.clientX;
      dragStartScrollLeft = el.scrollLeft;
      dragActive = false; // becomes true past the threshold
    };
    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || e.buttons !== 1) return;
      const delta = e.clientX - dragStartX;
      if (!dragActive && Math.abs(delta) < 5) return;
      if (!dragActive) {
        dragActive = true;
        el.setPointerCapture(e.pointerId);
        el.style.cursor = "grabbing";
      }
      el.scrollLeft = dragStartScrollLeft - delta;
    };
    const onPointerUp = (e: PointerEvent) => {
      if (dragActive) {
        try { el.releasePointerCapture(e.pointerId); } catch { /* noop */ }
        el.style.cursor = "";
      }
      dragActive = false;
    };
    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerUp);

    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerUp);
      ro.disconnect();
    };
  }, [updateEdges]);

  const scrollBy = useCallback((direction: "left" | "right") => {
    const el = ref.current;
    if (!el) return;
    const step = Math.round(el.clientWidth * 0.85);
    el.scrollBy({ left: direction === "left" ? -step : step, behavior: "smooth" });
  }, []);

  return { ref, canLeft, canRight, scrollBy };
}
