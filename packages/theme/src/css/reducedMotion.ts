import { CSS_VAR_NAMES } from "./varNames";

/**
 * Reduced-motion overrides — mirrors the existing `@media (prefers-reduced-motion: reduce)`
 * block in `apps/web/src/theme/tokens.css`. Values are intentionally hard-coded
 * (not derived from another preset) to match the current behavior 1:1.
 */
export const REDUCED_MOTION_OVERRIDES: ReadonlyArray<readonly [string, string]> =
  [
    [CSS_VAR_NAMES.motion.duration.instant, "0ms"],
    [CSS_VAR_NAMES.motion.duration.fast, "0ms"],
    [CSS_VAR_NAMES.motion.duration.base, "0ms"],
    [CSS_VAR_NAMES.motion.duration.slow, "0ms"],
    [CSS_VAR_NAMES.motion.duration.page, "0ms"],
    [CSS_VAR_NAMES.motion.duration.press, "0ms"],
    [CSS_VAR_NAMES.motion.duration.hover, "0ms"],
    [CSS_VAR_NAMES.motion.duration.menuIn, "0ms"],
    [CSS_VAR_NAMES.motion.duration.menuOut, "0ms"],
    [CSS_VAR_NAMES.motion.duration.card, "0ms"],
    [CSS_VAR_NAMES.motion.duration.sheetIn, "0ms"],
    [CSS_VAR_NAMES.motion.duration.sheetOut, "0ms"],
    [CSS_VAR_NAMES.motion.hoverDelay, "0ms"],
    [CSS_VAR_NAMES.motion.hoverScale, "1"],
    [CSS_VAR_NAMES.motion.pressScale, "1"],
    [CSS_VAR_NAMES.motion.cardHoverScale, "1"],
  ];
