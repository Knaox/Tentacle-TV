import { useLayoutEffect, useState, type RefObject } from "react";
import { placeFloating, samePlacement, type AnchorRect, type FloatingAlign, type FloatingPlacement, type FloatingSide } from "./floatingPlacement";

export interface FloatingOptions {
  side?: FloatingSide;
  align?: FloatingAlign;
  gap?: number;
  margin?: number;
}

/** L'ancre : un élément (bouton) ou un point (clic droit). */
export type FloatingAnchor = RefObject<Element | null> | { x: number; y: number };

function anchorRect(anchor: FloatingAnchor): AnchorRect | null {
  if ("x" in anchor) return { top: anchor.y, bottom: anchor.y, left: anchor.x, right: anchor.x };
  const el = anchor.current;
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
}

/**
 * Mesure l'ancre et le panneau, et applique `placeFloating` — avant la
 * peinture, puis à chaque redimensionnement de la fenêtre, défilement (d'où
 * qu'il vienne) ou changement de taille du panneau. Rend `null` tant que la
 * première mesure n'est pas faite : le panneau reste invisible jusque-là.
 */
export function useFloatingPlacement(
  open: boolean,
  anchor: FloatingAnchor,
  panelRef: RefObject<HTMLElement | null>,
  { side, align, gap, margin }: FloatingOptions = {},
): FloatingPlacement | null {
  const [placement, setPlacement] = useState<FloatingPlacement | null>(null);
  const pointX = "x" in anchor ? anchor.x : null;
  const pointY = "x" in anchor ? anchor.y : null;

  useLayoutEffect(() => {
    if (!open) { setPlacement(null); return; }
    const panel = panelRef.current;
    if (!panel) return;
    let frame = 0;
    const place = () => {
      frame = 0;
      const rect = anchorRect(anchor);
      if (!rect) return;
      // La taille NATURELLE : les bornes de la mesure précédente levées le temps de lire.
      const { maxHeight, maxWidth } = panel.style;
      panel.style.maxHeight = "none";
      panel.style.maxWidth = "none";
      const size = { width: panel.offsetWidth, height: panel.offsetHeight };
      panel.style.maxHeight = maxHeight;
      panel.style.maxWidth = maxWidth;
      const next = placeFloating({
        anchor: rect, size, side, align, gap, margin,
        viewport: { width: document.documentElement.clientWidth, height: window.innerHeight },
      });
      setPlacement((cur) => (samePlacement(cur, next) ? cur : next));
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(place); };
    place();
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, { capture: true, passive: true });
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    observer?.observe(panel);
    if (!("x" in anchor) && anchor.current) observer?.observe(anchor.current);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, { capture: true });
      observer?.disconnect();
    };
    // L'ancre ponctuelle se compare par ses coordonnées, pas par l'objet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pointX, pointY, side, align, gap, margin, panelRef]);

  return open ? placement : null;
}
