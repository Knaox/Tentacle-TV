import { SEARCH_KEYBOARD_CLOSED_LANDING } from "@tentacle-tv/tv-core";

/**
 * Android TV — voir `keyboardClosed.ts`. Rien n'y rend le focus au champ à la
 * fermeture du clavier : on réclame directement là où l'Apple TV finit (le
 * champ), au lieu de la première touche (nav-golden `--android`,
 * `ecrans/recherche#recherche-menu-ferme-clavier`).
 */
export const KEYBOARD_CLOSED_CLAIM = SEARCH_KEYBOARD_CLOSED_LANDING;
