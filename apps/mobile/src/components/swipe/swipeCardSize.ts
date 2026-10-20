/** Largeur maximale d'une carte de la pile sur téléphone (et dans « Affiner »). */
export const SWIPE_CARD_MAX_WIDTH = 420;
/** La place laissée sous la carte aux cartes en attente, qui dépassent en bas. */
export const SWIPE_STACK_PEEK = 24;

/**
 * La plus grande carte 2:3 qui tient dans la place mesurée, sous un plafond :
 * 420 pt sur téléphone ; sur iPad, la colonne entière, pour que la carte
 * suive la HAUTEUR au lieu de flotter, petite, au milieu de l'écran.
 */
export function swipeCardWidth(box: { w: number; h: number }, maxWidth: number = SWIPE_CARD_MAX_WIDTH): number {
  return Math.max(0, Math.floor(Math.min(box.w, (box.h - SWIPE_STACK_PEEK) * (2 / 3), maxWidth)));
}
