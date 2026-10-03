import type { Direction } from "../input/keys";
import { RATING_ENTRY, RATING_SCORES } from "./sheetKeys";

/**
 * L'ÉCHELLE HORIZONTALE de la note, dans le grand panneau : ce qu'elle vise
 * et ce qu'elle montre, selon le focus de ses crans.
 *
 * - La VISÉE suit le focus : le cran focalisé ; au flou, elle ne tombe que si
 *   c'était elle (le focus passé au voisin l'a déjà remplacée).
 * - Le CENTRE est la visée, sinon la note posée, sinon 5 ; « Retirer la
 *   note » vient après le 10 : la règle glisse pour poser ce cran au milieu,
 *   les autres pâlissent avec la distance.
 * - Le RETRAIT paraît dès qu'une note existe et RESTE : une note retirée
 *   depuis l'ouverture ne fait pas disparaître le cran qui a le focus.
 * - GAUCHE / DROITE passent au cran voisin (sur tvOS, par la géométrie seule :
 *   chaque cran touche ses voisins) ; DROITE bute sur le retrait, sinon sur
 *   10 ; GAUCHE bute sur 1.
 */

/** Ce que vise le focus de l'échelle : un cran, ou le retrait. */
export type RulerAim = number | "remove";

/** L'index du retrait : après le dernier cran. */
export const RULER_REMOVE_INDEX = RATING_SCORES.length;

/** Le focus arrive sur un cran (`focused`) ou le quitte : la visée qui en résulte. */
export function rulerAimAfter(now: RulerAim | null, next: RulerAim, focused: boolean): RulerAim | null {
  if (focused) return next;
  return now === next ? null : now;
}

/** L'index du cran posé au centre de la fenêtre. */
export function rulerCenterIndex(aim: RulerAim | null, current: number | null): number {
  if (aim === "remove") return RULER_REMOVE_INDEX;
  return (typeof aim === "number" ? aim : current ?? RATING_ENTRY) - 1;
}

/** Le retrait est paru (et le reste) : déjà paru, ou une note est posée. */
export function rulerRemovable(shown: boolean, current: number | null): boolean {
  return shown || current !== null;
}

/** Ce que le panneau dit de la note, selon la visée. */
export interface RulerReading {
  /** La note dessinée en étoiles, sur 10 ; 0 : cinq étoiles vides. On voit ce qui part, pâli. */
  stars: number;
  /** Les étoiles pâlissent : le retrait visé, ou la note qui se résout. */
  dim: boolean;
  /** La grande valeur : en attente (« … »), aucune (« — »), ou une note. */
  value: "pending" | "none" | number;
  /** La ligne, ce que fera OK : rien (attente), retirer, noter la visée, la note actuelle, pas encore noté. */
  line: "pending" | "remove" | "rate" | "current" | "unrated";
}

export function rulerReading(aim: RulerAim | null, current: number | null, pending: boolean): RulerReading {
  const removing = aim === "remove";
  const aimed = typeof aim === "number" ? aim : null;
  const stars = aimed ?? current ?? 0;
  let line: RulerReading["line"];
  if (pending) line = "pending";
  else if (removing) line = "remove";
  else if (aimed !== null && aimed !== current) line = "rate";
  else line = current !== null ? "current" : "unrated";
  return {
    stars,
    dim: removing || pending,
    value: pending ? "pending" : removing || stars === 0 ? "none" : stars,
    line,
  };
}

/** GAUCHE / DROITE depuis un cran : le cran atteint (le même à une butée). */
export function rulerStep(aim: RulerAim, direction: Direction, removable: boolean): RulerAim {
  const last = RATING_SCORES[RATING_SCORES.length - 1];
  if (direction === "droite") {
    if (aim === "remove") return aim;
    if (aim < last) return aim + 1;
    return removable ? "remove" : aim;
  }
  if (direction === "gauche") {
    if (aim === "remove") return last;
    return aim > RATING_SCORES[0] ? aim - 1 : aim;
  }
  return aim;
}
