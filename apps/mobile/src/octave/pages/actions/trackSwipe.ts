/**
 * Octave mobile — le BALAYAGE vers la droite d'une rangée de titre, en règle pure : un balayage COURT
 * découvre « Lire ensuite » (un bouton qu'on touche), un balayage LONG, au-delà du seuil, ajoute le titre
 * à la file d'attente dès le lâcher. Seul le sens vers la droite agit ; vers la gauche, une rangée ouverte
 * se referme. Le geste ne naît que franchement horizontal (le défilement vertical garde la main).
 */

export type TrackSwipeVerdict = "enqueue" | "reveal" | "close";

/** Le mouvement minimal avant que la rangée ne prenne le geste. */
export const TRACK_SWIPE_SLOP = 12;
/** La largeur du bouton « Lire ensuite » découvert (au-delà des 44 pt d'une cible). */
export const TRACK_SWIPE_REVEAL = 96;
/** Un coup bref (pt/ms) ouvre la rangée même avant la moitié du bouton. */
const FLICK = 0.5;

/** Le seuil du balayage LONG : la moitié de la rangée, jamais trop près du bouton ni du bord. */
export function trackSwipeCommit(width: number): number {
  return Math.min(Math.max(width * 0.5, TRACK_SWIPE_REVEAL + 72), 260);
}

/** La rangée prend-elle le geste ? Franchement horizontal, vers la droite (ou vers la gauche si ouverte). */
export function claimsTrackSwipe(dx: number, dy: number, open: boolean): boolean {
  if (Math.abs(dx) <= TRACK_SWIPE_SLOP || Math.abs(dx) <= Math.abs(dy) * 2) return false;
  return dx > 0 || open;
}

/** Le décalage montré sous le doigt : jamais vers la gauche, freiné au-delà du seuil long. */
export function trackSwipeOffset(dx: number, open: boolean, width: number): number {
  const raw = Math.max(0, dx + (open ? TRACK_SWIPE_REVEAL : 0));
  const commit = trackSwipeCommit(width);
  return raw <= commit ? raw : commit + (raw - commit) * 0.35;
}

/** Le seuil long est-il atteint (la rangée annonce alors « Ajouter à la file ») ? */
export function trackSwipeArmed(offset: number, width: number): boolean {
  return offset >= trackSwipeCommit(width);
}

/** Au lâcher : ajouter à la file, laisser « Lire ensuite » découvert, ou refermer. */
export function decideTrackSwipe(input: { offset: number; vx: number; width: number }): TrackSwipeVerdict {
  const { offset, vx, width } = input;
  if (trackSwipeArmed(offset, width)) return "enqueue";
  if (vx < -FLICK) return "close";
  if (offset >= TRACK_SWIPE_REVEAL / 2 || (vx > FLICK && offset > TRACK_SWIPE_SLOP)) return "reveal";
  return "close";
}
