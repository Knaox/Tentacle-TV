/**
 * Octave mobile — le BALAYAGE d'une rangée de titre, en règle pure. Vers la DROITE : un balayage court
 * découvre « Lire ensuite » (un bouton qu'on touche), un balayage LONG, au-delà du seuil, ajoute le titre à
 * la file d'attente dès le lâcher. Vers la GAUCHE, seulement là où l'on a le droit de retirer le titre de la
 * liste (`removable` : playlist à soi, ou partagée avec le droit « retirer ») : un balayage court découvre
 * « Retirer », un balayage long le retire au lâcher (l'avis porte « Annuler », jamais une confirmation).
 * Ailleurs, vers la gauche, une rangée ouverte se referme. Le geste ne naît que franchement horizontal
 * (le défilement vertical garde la main).
 */

export type TrackSwipeVerdict = "enqueue" | "reveal" | "remove" | "revealRemove" | "close";
/** Le côté découvert d'une rangée ouverte : `right` (glissée vers la droite, « Lire ensuite »), `left` (« Retirer »). */
export type TrackSwipeSide = "right" | "left";

/** Le mouvement minimal avant que la rangée ne prenne le geste. */
export const TRACK_SWIPE_SLOP = 12;
/** La largeur du bouton découvert (au-delà des 44 pt d'une cible). */
export const TRACK_SWIPE_REVEAL = 96;
/** Un coup bref (pt/ms) ouvre la rangée même avant la moitié du bouton. */
const FLICK = 0.5;

/** Le seuil du balayage LONG : la moitié de la rangée, jamais trop près du bouton ni du bord. */
export function trackSwipeCommit(width: number): number {
  return Math.min(Math.max(width * 0.5, TRACK_SWIPE_REVEAL + 72), 260);
}

/** La rangée prend-elle le geste ? Franchement horizontal, vers un côté qui agit (ou pour refermer). */
export function claimsTrackSwipe(dx: number, dy: number, open: TrackSwipeSide | null, removable = false): boolean {
  if (Math.abs(dx) <= TRACK_SWIPE_SLOP || Math.abs(dx) <= Math.abs(dy) * 2) return false;
  return dx > 0 || removable || open !== null;
}

const brake = (raw: number, commit: number) => (raw <= commit ? raw : commit + (raw - commit) * 0.35);

/** Le décalage montré sous le doigt (négatif : vers la gauche), freiné au-delà du seuil long. */
export function trackSwipeOffset(dx: number, open: TrackSwipeSide | null, width: number, removable = false): number {
  const base = open === "right" ? TRACK_SWIPE_REVEAL : open === "left" ? -TRACK_SWIPE_REVEAL : 0;
  const raw = dx + base;
  const commit = trackSwipeCommit(width);
  if (raw >= 0) return brake(raw, commit);
  return removable ? -brake(-raw, commit) : 0;
}

/** Le seuil long est-il atteint (la rangée annonce alors « Ajouter à la file » ou « Retirer ») ? */
export function trackSwipeArmed(offset: number, width: number): boolean {
  return Math.abs(offset) >= trackSwipeCommit(width);
}

/** Au lâcher : ajouter à la file, retirer, laisser un bouton découvert, ou refermer. */
export function decideTrackSwipe(input: { offset: number; vx: number; width: number }): TrackSwipeVerdict {
  const { offset, vx, width } = input;
  if (trackSwipeArmed(offset, width)) return offset > 0 ? "enqueue" : "remove";
  const sign = offset < 0 ? -1 : 1;
  const away = offset * sign;
  const speed = vx * sign;
  if (speed < -FLICK) return "close";
  if (away >= TRACK_SWIPE_REVEAL / 2 || (speed > FLICK && away > TRACK_SWIPE_SLOP)) return sign > 0 ? "reveal" : "revealRemove";
  return "close";
}
