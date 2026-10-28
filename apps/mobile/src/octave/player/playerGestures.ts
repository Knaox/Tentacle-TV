/**
 * Octave (mobile) — les règles PURES des gestes du lecteur (`playerGestures.test.ts`) :
 * - BALAYER la pochette ou le mini-lecteur de côté change de titre (gauche : suivant, droite : précédent) ;
 * - GLISSER vers le haut le mini-lecteur ouvre le lecteur, vers le bas le lecteur le referme.
 * Un seuil de mouvement avant de prendre le geste (un appui qui tremble reste un appui), et une décision au
 * lâcher qui écoute la DISTANCE ou la VITESSE (un geste vif et court compte).
 */

/** En deçà (pt), le doigt n'a pas encore choisi : rien n'est pris. */
export const GESTURE_SLOP = 10;
/** Le titre change au-delà de cette part de la largeur… */
const SWIPE_DISTANCE_SHARE = 0.28;
/** … ou au-delà de cette vitesse (pt/ms, celle de `PanResponder`). */
const SWIPE_VELOCITY = 0.55;
/** Le lecteur se referme au-delà de cette distance (pt) ou de cette vitesse. */
const DISMISS_DISTANCE = 140;
const DISMISS_VELOCITY = 0.9;
/** Le mini-lecteur ouvre le lecteur au-delà de cette distance vers le haut, ou de cette vitesse. */
const OPEN_DISTANCE = 44;
const OPEN_VELOCITY = 0.45;

export type Axis = "horizontal" | "vertical" | null;

/** Le geste a-t-il choisi un axe ? (`null` : pas encore — sous le seuil). */
export function gestureAxis(dx: number, dy: number): Axis {
  if (Math.abs(dx) < GESTURE_SLOP && Math.abs(dy) < GESTURE_SLOP) return null;
  return Math.abs(dx) > Math.abs(dy) * 1.2 ? "horizontal" : "vertical";
}

export type SwipeOutcome = "next" | "previous" | "stay";

/** Au lâcher d'un balayage de côté sur une zone de `width` pt. */
export function decideSwipe(dx: number, vx: number, width: number): SwipeOutcome {
  const far = Math.abs(dx) > Math.max(48, width * SWIPE_DISTANCE_SHARE);
  const quick = Math.abs(vx) > SWIPE_VELOCITY && Math.abs(dx) > GESTURE_SLOP * 2;
  if (!far && !quick) return "stay";
  return dx < 0 ? "next" : "previous";
}

/** Où sort la pochette balayée (pt) : à gauche vers le suivant, à droite vers le précédent, hors de l'écran. */
export function swipeExitOffset(outcome: "next" | "previous", width: number): number {
  return (outcome === "next" ? -1 : 1) * width * 1.15;
}

/** Au lâcher du lecteur tiré vers le bas : refermer ? */
export function decideDismiss(dy: number, vy: number): boolean {
  return dy > DISMISS_DISTANCE || (vy > DISMISS_VELOCITY && dy > GESTURE_SLOP * 2);
}

/** Au lâcher du mini-lecteur tiré vers le haut : ouvrir ? */
export function decideOpen(dy: number, vy: number): boolean {
  return -dy > OPEN_DISTANCE || (-vy > OPEN_VELOCITY && -dy > GESTURE_SLOP);
}

/** Le suivi du doigt, amorti au-delà du possible (pas de titre précédent ou suivant : un élastique). */
export function rubberBand(offset: number, allowed: boolean, limit = 80): number {
  if (allowed) return offset;
  const sign = Math.sign(offset);
  const distance = Math.abs(offset);
  return sign * (limit * (1 - 1 / (distance / limit + 1)));
}

/** Le lecteur tiré vers le haut au-delà de sa place : un élastique (on ne le sort pas de l'écran par le haut). */
export function sheetDragOffset(dy: number): number {
  return dy >= 0 ? dy : rubberBand(dy, false, 40);
}
