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
