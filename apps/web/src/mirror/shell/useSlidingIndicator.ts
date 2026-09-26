import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";

/**
 * La pilule qui marque l'onglet actif et GLISSE de l'un à l'autre
 * (`TabIndicator` + `useSlidingIndicator` de l'app). Elle est toujours montée ;
 * seuls sa translation et son opacité changent — les deux propriétés que le
 * compositeur anime sans repeindre.
 *
 * `size` fixe la pilule (52×32 dans la barre) ; sans, elle prend la taille de
 * l'item actif. `align` la cale en haut de l'item (barre : sur l'icône) ou au
 * centre (rail, tiroir). `shiftY` la suit quand l'icône descend (repli).
 */
export function useSlidingIndicator(
  activeIndex: number,
  opts: { size?: { width: number; height: number }; align: "top" | "center"; shiftY?: number; deps?: unknown[] },
) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [animate, setAnimate] = useState(false);
  const { size, align } = opts;
  const width = size?.width;
  const height = size?.height;

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const measure = () => {
      const item = track.querySelectorAll<HTMLElement>("[data-tab-item]")[activeIndex];
      if (!item) {
        setBox(null);
        return;
      }
      const w = width ?? item.offsetWidth;
      const h = height ?? item.offsetHeight;
      const x = item.offsetLeft + (item.offsetWidth - w) / 2;
      const y = item.offsetTop + (align === "top" ? 0 : (item.offsetHeight - h) / 2);
      setBox({ x, y, w, h });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(track);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, width, height, align, ...(opts.deps ?? [])]);

  // Première pose sans transition : la pilule ne doit pas « arriver » du coin.
  useLayoutEffect(() => {
    if (box && !animate) {
      const id = requestAnimationFrame(() => setAnimate(true));
      return () => cancelAnimationFrame(id);
    }
  }, [box, animate]);

  const style: CSSProperties = box
    ? {
        width: box.w,
        height: box.h,
        transform: `translate3d(${box.x}px, ${box.y + (opts.shiftY ?? 0)}px, 0)`,
        opacity: 1,
        transition: animate ? "transform 320ms cubic-bezier(0.22, 1, 0.36, 1), opacity 160ms ease-out" : "none",
      }
    : { opacity: 0 };

  return { trackRef, style };
}
