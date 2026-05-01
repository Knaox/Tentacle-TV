/**
 * Card sizing tokens for the TV app.
 * Slightly larger than web counterparts because TV viewing distance is 3m+
 * — needs ~25% more visual mass to read comfortably.
 */

export type TVCardSize = "sm" | "md" | "lg";

export const TV_POSTER_WIDTH: Record<TVCardSize, number> = {
  sm: 150,
  md: 180,   // default for rows
  lg: 220,
};

export const TV_EPISODE_WIDTH: Record<TVCardSize, number> = {
  sm: 280,
  md: 320,   // default for Continue Watching
  lg: 380,
};

export const TV_CARD_RADIUS = 8;
export const TV_CARD_PROGRESS_HEIGHT = 4;
