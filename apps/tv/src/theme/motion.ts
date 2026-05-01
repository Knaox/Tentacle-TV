import { Easing } from "react-native-reanimated";

/**
 * Motion tokens for the TV app.
 * Aligned with the web theme (`apps/web/src/theme/motion.ts`) but tuned
 * slightly faster — TV interactions are D-pad-driven and benefit from
 * snappier feedback than mouse hover delays.
 */

export const Durations = {
  /** Card press, button highlight. */
  fast: 150,
  /** Default state transition. */
  base: 220,
  /** Section reveal, large transforms. */
  slow: 360,
  /** Hero crossfade, ambient backdrop swap. */
  hero: 800,
} as const;

export const Easings = {
  /** Default exit + enter. */
  out: Easing.out(Easing.cubic),
  /** Modal / sheet snap. */
  inOut: Easing.inOut(Easing.cubic),
  /** Sidebar slide. */
  outQuad: Easing.out(Easing.quad),
} as const;

/**
 * Spring config for focus animations — tuned to match the existing
 * Focusable.tsx behaviour so refactors don't change the feel.
 */
export const FocusSpring = {
  damping: 18,
  stiffness: 200,
  mass: 1,
} as const;

/**
 * Spring config for ambient backdrop crossfade — softer, slower.
 */
export const AmbientSpring = {
  damping: 25,
  stiffness: 60,
  mass: 1,
} as const;
