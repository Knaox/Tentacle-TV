import { canOpenRailMenu } from "./railMenu";

/**
 * L'INDICATION « Maintenir OK : organiser » du rail — module pur. Plus de
 * légende permanente : une ligne discrète, à côté de l'entrée focalisée,
 * seulement quand elle dit quelque chose d'utile :
 *
 * - sur une entrée ORGANISABLE (celles qu'un appui maintenu ouvre, `railMenu`),
 *   hors déplacement et menu fermé ;
 * - après un court temps de focus SUR elle (`RAIL_HINT_DWELL_MS`) : parcourir
 *   le rail ne la fait jamais clignoter d'entrée en entrée ;
 * - les premières fois seulement (`RAIL_HINT_MAX_SHOWS` passages dans le rail
 *   où elle a paru), puis plus jamais : le geste vit aussi dans Réglages ›
 *   Navigation.
 */

/** Le temps de focus sur une entrée avant que l'indication paraisse. */
export const RAIL_HINT_DWELL_MS = 1200;
/** Le nombre de passages dans le rail où elle paraît, au plus. */
export const RAIL_HINT_MAX_SHOWS = 3;
/** Le compte des passages, rangé sur l'appareil. ⚠️ Traversée par le stockage : ne jamais renommer. */
export const RAIL_HINT_SHOWN_KEY = "tentacle_rail_organize_hint";

/** Dans combien de temps l'indication paraît pour cette entrée ; null : pas pour elle (ou plus jamais). */
export function railHintDelay(state: { entryKey: string | null; moving: boolean; menuOpen: boolean; shown: number }): number | null {
  if (!state.entryKey || state.menuOpen || state.shown >= RAIL_HINT_MAX_SHOWS) return null;
  return canOpenRailMenu(state.entryKey, state.moving) ? RAIL_HINT_DWELL_MS : null;
}

/** Le compte rangé ; illisible ou absent : zéro. */
export function readRailHintShown(raw: string | null): number {
  const value = raw === null ? Number.NaN : Number.parseInt(raw, 10);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/** Le compte après un passage dans le rail : il ne compte qu'UNE fois par passage, même si l'indication paraît sur plusieurs entrées. */
export function railHintShownAfter(shown: number, countedThisVisit: boolean): number {
  return countedThisVisit ? shown : shown + 1;
}
