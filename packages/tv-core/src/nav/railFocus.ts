import { isNavKey } from "./railKeys";

/**
 * Le rail OUVERT ou REPLIÉ, selon le focus — module pur : l'adaptateur lui
 * dit ce qui prend et perd le focus, il dit l'état.
 *
 * - Une clé de la navigation prend le focus (une entrée, le profil, l'aperçu
 *   des demandes, une ligne du menu d'une entrée) : le rail s'OUVRE.
 * - Une clé de CONTENU prend le focus : il se REPLIE, aussitôt.
 * - Une clé de la navigation PERD le focus : on attend un court instant
 *   (`RAIL_COLLAPSE_DELAY_MS`) que le focus se pose. Passer d'une entrée à
 *   l'autre ne replie donc rien. Posé dans le contenu : replié. Parti HORS de
 *   l'écran — dans une Modal qui a son propre magasin de focus (la fenêtre
 *   des demandes) — : le rail reste ouvert dessous. Replié sous la Modal, il
 *   se redépliait à sa fermeture (filmé : replié quatre images, puis déplié).
 * - Le menu d'une entrée ouvert ou un déplacement en cours le gardent ouvert.
 */

export const RAIL_COLLAPSE_DELAY_MS = 30;

/** Un focus se pose : le rail est-il focalisé désormais ? */
export function railFocusedAfterFocus(focusKey: string): boolean {
  return isNavKey(focusKey);
}

/**
 * Une clé a perdu le focus. Rend `null` si cela ne concerne pas le rail (une
 * clé de contenu : rien à attendre), sinon le délai avant de relire le focus
 * (`railCollapseAfterBlur`).
 */
export function railBlurDelay(blurredKey: string): number | null {
  return isNavKey(blurredKey) ? RAIL_COLLAPSE_DELAY_MS : null;
}

/**
 * Le délai passé, le focus relu (`null` : aucune clé de l'écran ne l'a — il
 * est dans une Modal) : faut-il replier ?
 */
export function railCollapseAfterBlur(focusedNow: string | null): boolean {
  return focusedNow !== null && !isNavKey(focusedNow);
}

/** Le rail est ouvert : le focus y est, son menu est ouvert, ou une entrée s'y déplace. */
export function railExpanded(state: { railFocused: boolean; heldKey: string | null; movingKey: string | null }): boolean {
  return state.railFocused || state.heldKey !== null || state.movingKey !== null;
}
