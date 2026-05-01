import { BRAND } from "@tentacle-tv/shared";

export type FocusVariant = "card" | "button" | "row" | "default";

export const FocusSpring = { damping: 18, stiffness: 200 } as const;

/**
 * Per-variant focus scale.
 * Bumped slightly vs. legacy to make the cinematic hover effect more apparent
 * on TV viewing distances (3m+).
 */
export const FocusScale = {
  card: 1.06,
  button: 1.07,
  row: 1.0,
  default: 1.06,
  normal: 1.0,
  /** Hero CTA gets a subtle 1.02 scale — applied manually inside hero. */
  hero: 1.02,
} as const;

/**
 * Crisp violet border drawn around focused cards/buttons.
 * Replaces the old glow-only treatment, which was too soft on TV displays.
 */
export const FocusBorder = {
  width: 2,
  color: BRAND.violet,
  /** Slightly translucent so the border doesn't fight with the image edge. */
  opacity: 0.85,
} as const;

/**
 * Ambient halo behind focused elements.
 * Implemented via shadow on iOS and elevation on Android (TV is Android only).
 */
export const FocusGlow = {
  color: BRAND.glow,
  opacity: 0.55,
  shadowColor: BRAND.violet,
  shadowOpacity: 0.55,
  shadowRadius: 24,
  elevation: 12,
} as const;

/**
 * Row variant — used for sidebar items, list rows.
 * No scale; uses an animated left bar + tinted bg instead.
 */
export const FocusRowStyle = {
  bgColor: "rgba(139, 92, 246, 0.14)",
  barColor: BRAND.violet,
  barWidth: 3,
} as const;

/**
 * Button variant — focus state for action buttons (Play, More info, etc.).
 */
export const FocusButtonStyle = {
  bgColor: "rgba(139, 92, 246, 0.20)",
  borderColor: "rgba(139, 92, 246, 0.6)",
  borderWidth: 2,
} as const;
