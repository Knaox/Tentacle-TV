import { useEffect, useState } from "react";

/**
 * Returns a 0→1 scroll-driven progress value used to fade the top nav
 * from transparent (over the hero) to opaque (over content).
 *
 * Why a hook: lets the nav stay client-only and doesn't pollute layout effects.
 */
export function useScrollOpacity(threshold = 80): number {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const compute = () => {
      const y = window.scrollY;
      const p = Math.min(1, Math.max(0, y / threshold));
      setProgress(p);
    };
    compute();
    window.addEventListener("scroll", compute, { passive: true });
    return () => window.removeEventListener("scroll", compute);
  }, [threshold]);

  return progress;
}
