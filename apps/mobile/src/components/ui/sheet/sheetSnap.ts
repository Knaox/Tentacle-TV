/**
 * Les crans d'une feuille du bas, en règles pures (aucun React Native) : la
 * feuille vit à DEUX crans — 0 : le premier (moitié, souvent), 1 : le plein —
 * et se ferme sous le premier. Le lâcher décide d'après la distance ET la
 * vitesse (un coup bref suffit, comme les feuilles d'iOS).
 */

export type SheetSnap = 0 | 1;
export type SheetRelease = "dismiss" | "collapse" | "expand" | "stay";

/** Au-delà de cette distance (pt), le lâcher change de cran. */
export const SHEET_DISTANCE = 56;
/** Au-delà de cette vitesse (pt/ms), un coup bref change de cran. */
export const SHEET_FLICK = 0.5;
/** Mouvement minimal avant que la feuille ne prenne le geste (pas de saisie accidentelle). */
export const SHEET_DRAG_SLOP = 8;

export function decideSheetRelease(input: { snap: SheetSnap; dy: number; vy: number; canExpand: boolean }): SheetRelease {
  const { snap, dy, vy, canExpand } = input;
  const down = dy > SHEET_DISTANCE || vy > SHEET_FLICK;
  const up = dy < -SHEET_DISTANCE || vy < -SHEET_FLICK;
  if (snap === 0) {
    if (down && dy > 0) return "dismiss";
    if (up && dy < 0 && canExpand) return "expand";
    return "stay";
  }
  // Du plein : un grand geste vers le bas ferme d'un coup, un geste moyen redescend au premier cran.
  if (down && dy > 0) return dy > SHEET_DISTANCE * 4 || vy > SHEET_FLICK * 3 ? "dismiss" : "collapse";
  return "stay";
}

/**
 * La position (translation vers le bas, pt) pendant le glissement. Au-delà
 * du plein, la feuille résiste (élastique) au lieu de s'arrêter net.
 */
export function sheetDragOffset(input: { snap: SheetSnap; dy: number; minH: number; maxH: number }): number {
  const base = input.snap === 0 ? input.maxH - input.minH : 0;
  const next = base + input.dy;
  return next >= 0 ? next : next / 3;
}

/**
 * Le contenu prend-il le geste à la feuille ? Au premier cran, tout geste
 * vertical vers le HAUT agrandit d'abord (comme iOS) ; vers le bas, seulement
 * si la liste est en haut. Au plein, vers le bas seulement si la liste est en
 * haut — un contenu qui ne dit pas où il en est (`scrollTop` inconnu) garde
 * son défilement : on ne vole jamais un défilement.
 */
export function sheetCapturesFromContent(input: {
  snap: SheetSnap;
  dx: number;
  dy: number;
  canExpand: boolean;
  scrollTop: boolean | null;
}): boolean {
  const { snap, dx, dy, canExpand, scrollTop } = input;
  if (Math.abs(dy) < SHEET_DRAG_SLOP || Math.abs(dy) < Math.abs(dx) * 1.5) return false;
  if (dy < 0) return snap === 0 && canExpand;
  return scrollTop === true;
}
