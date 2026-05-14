/**
 * Shared spacing/radius/layout tokens — cross-platform (web/TV/mobile).
 * Pure module: no platform imports. Values in pixels (logical/dp).
 */

/** 4pt base spacing scale. */
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 40,
  "5xl": 48,
  "6xl": 64,
} as const;

/** Border radius scale (px). */
export const RADIUS = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  "2xl": 20,
  pill: 9999,
} as const;

/** Layout-level constants (chrome heights, gutters). */
export const LAYOUT = {
  /** Default horizontal padding for screens. */
  screenPadding: 16,
  /** Mobile bottom tab bar height (logical px). */
  tabBarHeight: 64,
  /** Mobile top nav height (without safe area). */
  topnavMobile: 56,
  /** Desktop top nav height. */
  topnavDesktop: 68,
  /** Gutter between row sections on mobile. */
  rowGutterMobile: 16,
  /** Gutter between row sections on desktop. */
  rowGutterDesktop: 56,
  /** Vertical rhythm between sections. */
  sectionGap: 24,
  /** Gap between cards in a row. */
  cardGap: 12,
} as const;

export type SpacingKey = keyof typeof SPACING;
export type RadiusKey = keyof typeof RADIUS;
export type LayoutKey = keyof typeof LAYOUT;
