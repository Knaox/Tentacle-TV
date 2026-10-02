/**
 * Les RÉGLAGES du défilement au pavé tactile de la Siri Remote (Apple TV) —
 * l'unique endroit où ils se retouchent, après l'essai sur l'appareil : le
 * simulateur ne glisse pas, aucune de ces valeurs n'a vu un vrai doigt.
 *
 * Unités : le pan de tvOS rend une TRANSLATION en points, comptée depuis le
 * centre (un toucher commence toujours au milieu de la vue focalisée) et
 * bornée à ±1920 horizontalement : toute la largeur du pavé vaut donc
 * ~1920 points. Les gains se disent en LARGEURS DE PAVÉ — ce que sent le
 * pouce —, plus en fraction de la durée : un même geste fait le même chemin
 * dans un épisode de vingt minutes et dans un film de trois heures.
 *
 * Le doigt levé (ou immobile), la validation est celle de toutes les entrées
 * (`RESUME_COUNTDOWN_MS`, `seekTuning.ts`).
 */

/** La largeur du pavé, en points de pan. Si la Siri Remote réelle dit autre
 *  chose, c'est ici seulement : gains et vitesses s'en déduisent. */
export const PAD_WIDTH_PT = 1920;

/** Un glisser LENT sur toute la largeur du pavé : 1 min 30 de vidéo (une
 *  seconde vaut alors ~21 points — la précision à la seconde). */
export const SLOW_FULL_SWIPE_SECONDS = 90;
/** Un glisser VIF sur toute la largeur : 6 min — le plafond, jamais dépassé. */
export const FAST_FULL_SWIPE_SECONDS = 360;
/** En deçà de cette vitesse (largeurs de pavé par seconde), le gain reste le
 *  plus fin… */
export const SLOW_SWIPE_PADS_PER_SECOND = 1;
/** …au-delà de celle-ci, il plafonne ; entre les deux, il monte en douceur. */
export const FAST_SWIPE_PADS_PER_SECOND = 4;

/** Habillage CACHÉ : un glisser ne défile qu'après ce contact tenu, compté
 *  depuis le début du glisser (tvOS ne signale pas un doigt posé immobile).
 *  Un frôlement, une télécommande qu'on ramasse : la lecture ne bouge pas. */
export const HIDDEN_ENGAGE_HOLD_MS = 600;

/** Le glisser n'engage qu'au-delà de cette course HORIZONTALE (points) :
 *  saisir la télécommande fait souvent glisser le pouce… */
export const ENGAGE_PX = 60;
/** …et s'il est franchement horizontal : un glisser vertical ne défile pas. */
export const HORIZONTAL_RATIO = 1.4;
/** Habillage affiché : après ce délai depuis le début du glisser, sauf geste
 *  franc (`FLICK_PX`). */
export const ENGAGE_DELAY_MS = 180;
export const FLICK_PX = 180;
/** Défilement déjà ouvert : le doigt revient VISER, il reprend dès ce pas. */
export const OPEN_ENGAGE_PX = 12;

/** Le régime d'un glisser, lu quand le doigt se pose : défilement déjà
 *  ouvert, habillage affiché (à l'écran, pause ou non), habillage caché. */
export type TouchMode = "open" | "shown" | "hidden";

/** Le glisser engage-t-il le défilement ? `dx`, `dy` : sa course depuis la
 *  pose du doigt ; `elapsedMs` : le contact tenu depuis. */
export function canEngage(mode: TouchMode, dx: number, dy: number, elapsedMs: number): boolean {
  const ax = Math.abs(dx);
  if (ax < HORIZONTAL_RATIO * Math.abs(dy)) return false;
  if (mode === "open") return ax >= OPEN_ENGAGE_PX;
  if (ax < ENGAGE_PX) return false;
  if (mode === "hidden") return elapsedMs >= HIDDEN_ENGAGE_HOLD_MS;
  return elapsedMs >= ENGAGE_DELAY_MS || ax >= FLICK_PX;
}

/**
 * Secondes de vidéo par point de pavé, selon la vitesse du doigt (points/s) —
 * l'accélération d'un pointeur, appliquée au temps : FINE quand le doigt est
 * lent (viser une scène à la seconde), plus LARGE quand il est vif, plafonnée.
 */
export function scrubGainFor(speed: number): number {
  const fine = SLOW_FULL_SWIPE_SECONDS / PAD_WIDTH_PT;
  const coarse = FAST_FULL_SWIPE_SECONDS / PAD_WIDTH_PT;
  const slow = SLOW_SWIPE_PADS_PER_SECOND * PAD_WIDTH_PT;
  const fast = FAST_SWIPE_PADS_PER_SECOND * PAD_WIDTH_PT;
  const t = Math.min(1, Math.max(0, (speed - slow) / (fast - slow)));
  return fine + (coarse - fine) * t * t * (3 - 2 * t);
}
