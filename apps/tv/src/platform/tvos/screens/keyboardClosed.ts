import { SEARCH_KEYBOARD_CLOSED_KEY } from "@tentacle-tv/tv-core";

/**
 * Ce que la recherche RÉCLAME quand Menu a fermé le clavier système sans
 * valider (RE-6). Apple TV : la première touche — UIKit rend ensuite le focus
 * au champ qui avait présenté le clavier (tv-core
 * `SEARCH_KEYBOARD_CLOSED_LANDING`). Android TV a sa variante
 * (`keyboardClosed.android.ts`).
 */
export const KEYBOARD_CLOSED_CLAIM = SEARCH_KEYBOARD_CLOSED_KEY;
