/**
 * Shared motion tokens — cross-platform (web/TV/mobile).
 *
 * Pure module: no Framer Motion / Reanimated imports. Each platform converts
 * the bezier 4-tuples to its own easing function (`cubic-bezier(...)` for CSS,
 * `Easing.bezier(...)` for Reanimated).
 */

/** Durations in ms. */
export const DURATIONS = {
  instant: 80,
  fast: 150,
  base: 240,
  slow: 400,
  page: 600,
  hero: 800,
} as const;

/** Bezier curves as 4-tuples [x1, y1, x2, y2]. */
export const EASINGS_BEZIER = {
  out: [0.22, 1, 0.36, 1] as const,
  inOut: [0.65, 0, 0.35, 1] as const,
  spring: [0.34, 1.56, 0.64, 1] as const,
  sheet: [0.32, 0.72, 0, 1] as const,
} as const;

/** Reanimated-friendly spring configs (damping/stiffness/mass). */
export const SPRINGS = {
  gentle: { damping: 20, stiffness: 200, mass: 1 },
  snappy: { damping: 18, stiffness: 280, mass: 1 },
  bouncy: { damping: 12, stiffness: 200, mass: 1 },
} as const;

/**
 * Generic motion presets — value objects usable by Framer Motion (web) and
 * Reanimated (mobile/TV) after adapter mapping.
 */
export const MOTION_PRESETS = {
  fadeUp: {
    from: { opacity: 0, translateY: 20 },
    to: { opacity: 1, translateY: 0 },
  },
  fadeIn: {
    from: { opacity: 0 },
    to: { opacity: 1 },
  },
  scaleIn: {
    from: { opacity: 0, scale: 0.96 },
    to: { opacity: 1, scale: 1 },
  },
} as const;

export type DurationKey = keyof typeof DURATIONS;
export type EasingKey = keyof typeof EASINGS_BEZIER;
export type SpringKey = keyof typeof SPRINGS;
