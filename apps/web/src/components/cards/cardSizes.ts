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

/**
 * Part de la largeur de fenêtre visée par une carte, en pourcent — le terme
 * central du `clamp(base, Xvw, lg)` posé sur chaque carte.
 */
export const POSTER_VW = 14;
export const EPISODE_VW = 24;

/**
 * Largeur « idéale » d'une carte, c'est-à-dire ce que le `clamp` CSS produirait.
 * Sert de point de départ au calage exact des rangées (`useRowCardWidth`), qui
 * arrondit ensuite à un nombre entier de cartes.
 */
export function idealCardWidth(
  widths: { base: number; lg: number },
  vw: number,
  viewportWidth: number,
): number {
  return Math.min(Math.max(widths.base, (viewportWidth * vw) / 100), widths.lg);
}

