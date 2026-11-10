import type { MotionTokens } from "../types";

/**
 * Ce que la TV lit ; le web a ses courbes et ses durées dans `tokens.css` (cf. la note de
 * `colors.ts`). Reduced-motion overrides are applied at emit time by `css/reducedMotion.ts`.
 */
export const DEFAULT_MOTION_TOKENS: MotionTokens = {
  easing: {
    out: "cubic-bezier(0.22, 1, 0.36, 1)",
    inOut: "cubic-bezier(0.65, 0, 0.35, 1)",
    spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
    drawer: "cubic-bezier(0.32, 0.72, 0, 1)",
  },
  duration: {
    instant: "80ms",
    fast: "150ms",
    base: "240ms",
    slow: "400ms",
    page: "600ms",
    press: "120ms",
    hover: "160ms",
    menuIn: "180ms",
    menuOut: "120ms",
    card: "220ms",
    sheetIn: "320ms",
    sheetOut: "200ms",
  },
  hoverDelay: "800ms",
  hoverScale: "1.5",
  pressScale: "0.97",
  cardHoverScale: "1.03",
};
