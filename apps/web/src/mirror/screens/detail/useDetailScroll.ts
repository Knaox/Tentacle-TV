import { useEffect, type RefObject } from "react";
import { TOP_BAR_FADE_SPAN } from "./detailMetrics";

/** Progression 0 → 1 d'une valeur entre deux bornes (l'`interpolate` CLAMP de l'app). */
export function progressBetween(value: number, from: number, to: number): number {
  if (to <= from) return value >= to ? 1 : 0;
  return Math.min(1, Math.max(0, (value - from) / (to - from)));
}

/** Les deux fondus de `DetailTopBar` pour un défilement donné. */
export function topBarProgress(scrollY: number, revealAt: number): { bar: number; title: number } {
  const from = Math.max(0, revealAt - TOP_BAR_FADE_SPAN);
  return {
    bar: progressBetween(scrollY, from, revealAt),
    title: progressBetween(scrollY, revealAt - TOP_BAR_FADE_SPAN / 2, revealAt),
  };
}

/**
 * Le `scrollY` partagé de l'app, sans rendu React : le défilement du
 * `scroller` s'écrit en variables CSS sur `host` (cf. `detail.css`), une fois
 * par image au plus.
 */
export function useDetailScroll(
  scrollerRef: RefObject<HTMLElement | null>,
  hostRef: RefObject<HTMLElement | null>,
  revealAt: number,
  /** Le défileur n'existe qu'une fois la fiche chargée : l'effet se rebranche alors. */
  ready: boolean,
): void {
  useEffect(() => {
    const scroller = scrollerRef.current;
    const host = hostRef.current;
    if (!ready || !scroller || !host) return;
    let frame = 0;
    const write = () => {
      frame = 0;
      const y = scroller.scrollTop;
      const { bar, title } = topBarProgress(y, revealAt);
      host.style.setProperty("--sy", String(y));
      host.style.setProperty("--bar", bar.toFixed(3));
      host.style.setProperty("--title", title.toFixed(3));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(write);
    };
    write();
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      scroller.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [scrollerRef, hostRef, revealAt, ready]);
}
