import type { MotionTokens } from "../types";

/**
 * Verbatim from `apps/web/src/theme/tokens.css`. Reduced-motion overrides are
 * applied at emit time by `css/reducedMotion.ts`, not here.
 */
export const DEFAULT_MOTION_TOKENS: MotionTokens = {
  easing: {
    out: "cubic-bezier(0.22, 1, 0.36, 1)",
    inOut: "cubic-bezier(0.65, 0, 0.35, 1)",
    spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
  },
  duration: {
    instant: "80ms",
    fast: "150ms",
    base: "240ms",
    slow: "400ms",
    page: "600ms",
  },
  hoverDelay: "800ms",
  hoverScale: "1.5",
};
