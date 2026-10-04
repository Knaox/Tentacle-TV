import { canOpenRailMenu } from "./railMenu";
import { RAIL_PROFILE_KEY, isNavMenuKey, navEntryOf } from "./railKeys";

/**
 * Les ASTUCES du rail ouvert — module pur. Deux lignes courtes, à droite du
 * rail, jamais focalisables, qui ne prennent aucune place dans la colonne :
 *
 * - « Maintenir OK : organiser », à hauteur de l'entrée ORGANISABLE qui a le
 *   focus (celles qu'un appui maintenu ouvre, `railMenu`), hors déplacement
 *   et menu fermé — TOUT DE SUITE, et à chaque fois (décision de
 *   l'utilisateur, 2026-10-04 : elle attendait 1,2 s de focus, et ne paraissait
 *   que les trois premières fois) ;
 * - « ◀ Réglages », à hauteur du profil : GAUCHE depuis toute entrée mène aux
 *   réglages (`railShortcuts`). Rail focalisé, hors déplacement et menu, pas
 *   sur le profil lui-même — GAUCHE n'y mène nulle part.
 *
 * Elles paraissent comme tout ce qui se révèle au focus (`focus/focusReveal`) :
 * sans attendre, en un fondu bref.
 *
 * Le compte d'apparitions d'avant (clé `tentacle_rail_organize_hint`) n'est
 * plus lu : resté sur l'appareil, il ne gêne rien.
 */

export interface RailHintState {
  /** L'entrée du rail qui a le focus (`navEntryOf`), ou null : le focus est ailleurs. */
  entryKey: string | null;
  moving: boolean;
  menuOpen: boolean;
}

/** L'entrée du rail que désigne une clé de focus, ou null (contenu, menu d'une entrée). */
export function railHintEntry(focusKey: string | null): string | null {
  return focusKey === null || isNavMenuKey(focusKey) ? null : navEntryOf(focusKey);
}

/** L'entrée à côté de laquelle dire « Maintenir OK : organiser », ou null. */
export function railOrganizeHintEntry(state: RailHintState): string | null {
  if (!state.entryKey || state.menuOpen) return null;
  return canOpenRailMenu(state.entryKey, state.moving) ? state.entryKey : null;
}

/** « ◀ Réglages » se dit-il ? Rail focalisé, hors déplacement et menu, ailleurs que sur le profil. */
export function railSettingsHintShown(state: RailHintState & { railFocused: boolean }): boolean {
  return state.railFocused && !state.moving && !state.menuOpen && state.entryKey !== null && state.entryKey !== RAIL_PROFILE_KEY;
}
