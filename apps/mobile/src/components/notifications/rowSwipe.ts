/**
 * Le lâcher d'une ligne de notification, en règle pure : vers la droite,
 * marquer lue (si elle ne l'est pas) ; vers la gauche, supprimer. Distance
 * (un quart de la largeur, 96 pt au plus) ou coup bref.
 */
export type RowSwipeAction = "markRead" | "delete" | "none";

export const ROW_SWIPE_SLOP = 10;
const FLICK = 0.6;

export function rowSwipeThreshold(width: number): number {
  return Math.min(96, width * 0.25);
}

export function decideRowSwipe(input: { dx: number; vx: number; width: number; read: boolean }): RowSwipeAction {
  const { dx, vx, width, read } = input;
  const threshold = rowSwipeThreshold(width);
  if (dx < 0 && (dx < -threshold * 1.4 || (vx < -FLICK && dx < -threshold / 2))) return "delete";
  if (dx > 0 && !read && (dx > threshold || (vx > FLICK && dx > threshold / 2))) return "markRead";
  return "none";
}
