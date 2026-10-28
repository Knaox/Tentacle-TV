/**
 * Octave — glisser une feuille vers le bas pour la fermer (le lecteur « en
 * cours » au doigt), règle PURE : quand le geste devient une descente, de
 * combien la feuille suit, et si le lâcher la ferme.
 *
 * - Le geste ne s'arme qu'en haut de la feuille (rien à remonter) et sur une
 *   descente franche (`ARM_PX`, plus verticale qu'horizontale) : un défilement
 *   ou un geste de côté reste au navigateur.
 * - La feuille suit le doigt vers le bas, freinée vers le haut (jamais au-dessus
 *   de sa place).
 * - Lâchée au-delà de `CLOSE_RATIO` de sa hauteur, ou lancée assez vite vers le
 *   bas, elle se ferme ; sinon elle revient.
 */

export const SWIPE_DISMISS = { ARM_PX: 10, CLOSE_RATIO: 0.22, CLOSE_MIN_PX: 120, FLING_PX_PER_MS: 0.65 } as const;

/** Le geste devient-il une descente de la feuille ? */
export function swipeArms(dx: number, dy: number, scrollTop: number): boolean {
  return scrollTop <= 0 && dy > SWIPE_DISMISS.ARM_PX && dy > Math.abs(dx);
}

/** Où la feuille se pose sous le doigt (px) : 1:1 vers le bas, freinée au-dessus de sa place. */
export function swipeOffset(dy: number): number {
  return dy >= 0 ? dy : dy / 4;
}

/** Au lâcher : fermer ? `velocity` en px/ms, positive vers le bas. */
export function swipeCloses(dy: number, velocity: number, height: number): boolean {
  if (dy <= 0) return false;
  if (velocity >= SWIPE_DISMISS.FLING_PX_PER_MS) return true;
  return dy >= Math.max(SWIPE_DISMISS.CLOSE_MIN_PX, height * SWIPE_DISMISS.CLOSE_RATIO);
}
