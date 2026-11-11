import { useLayoutEffect, useRef, type CSSProperties } from "react";
import { lastInputWasKeyboard } from "../../lib/inputModality";
import { MARKER_SLIDE_EASING, MARKER_SLIDE_MS, markerOrigin, rememberMarker, slideFromTransform } from "./markerSlide";

interface SlidingMarkerProps {
  /** Le groupe : les repères d'un même groupe se passent le relais. */
  group: string;
  className?: string;
  style?: CSSProperties;
  /** Posé sans glisser (animations réduites). */
  still?: boolean;
}

/**
 * Le repère de l'option retenue (`markerSlide.ts`) : à rendre DANS l'option, en `inset-0`.
 * Il glisse depuis l'option quittée — sauf si le choix vient du clavier (une touche ne s'anime
 * pas : flèches d'un groupe de boutons, télécommande) ou sous « réduire les animations ».
 */
export function SlidingMarker({ group, className, style, still = false }: SlidingMarkerProps) {
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const now = performance.now();
    const to = el.getBoundingClientRect();
    const from = still || lastInputWasKeyboard() || typeof el.animate !== "function" ? null : markerOrigin(group, to, now);
    if (from) {
      el.animate(
        [
          { transform: slideFromTransform(from, to), transformOrigin: "0 0" },
          { transform: "none", transformOrigin: "0 0" },
        ],
        { duration: MARKER_SLIDE_MS, easing: MARKER_SLIDE_EASING },
      );
    }
    // Démonté : sa place À CET INSTANT (un second clic pendant le glissement repart de là).
    return () => rememberMarker(group, el.getBoundingClientRect(), performance.now());
  }, [group, still]);

  return <span ref={ref} aria-hidden className={className} style={style} />;
}
