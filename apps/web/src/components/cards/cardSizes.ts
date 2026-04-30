/**
 * Card sizing tokens for the home/library rows.
 * Values are baseline widths (CSS px) per breakpoint; aspect ratio handles height.
 *
 * Keep these in sync with `MediaRow` row heights so skeleton + content share dimensions.
 */

export type CardSize = "sm" | "md" | "lg";

export const POSTER_WIDTH: Record<CardSize, { base: number; md: number; lg: number }> = {
  sm: { base: 120, md: 140, lg: 160 },
  md: { base: 150, md: 180, lg: 200 },
  lg: { base: 180, md: 220, lg: 260 },
};

export const EPISODE_WIDTH: Record<CardSize, { base: number; md: number; lg: number }> = {
  sm: { base: 220, md: 260, lg: 300 },
  md: { base: 280, md: 340, lg: 400 },
  lg: { base: 320, md: 400, lg: 480 },
};

