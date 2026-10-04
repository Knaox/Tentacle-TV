import type { FocusBinding } from "../../../redesign/focus/focusBinding";
import type { FocusExtras } from "../../tvos/focus/focusStore";

/**
 * Ce que le port pose sur les clés du lecteur, en natif, sur ANDROID TV — le
 * jumeau de `platform/tvos/player/playerFocusBindings.ts`, mêmes règles de
 * tv-core (`player/playerFocus.ts`) : la préférence d'origine d'une entrée
 * (`preferredFocusOf`) et la croix verrouillée (`exitLocked`).
 */

/**
 * La croix verrouillée : Android n'a pas `isTVSelectable`, et `focusable`
 * faux n'y retire que le clic (`ReactViewManager.setFocusable`) — c'est
 * `tvFocusable` qui rend la vue infocalisable (et bloque ses descendants). La
 * même valeur que le verrou du focus d'Android (`androidtv/focus/focusLocks`).
 */
export const END_EXIT_LOCK: FocusExtras = { native: { tvFocusable: false } };

/** La liaison avec sa préférence d'origine ; `undefined` : celle de toujours.
 *  `hasTVPreferredFocus` existe aussi sur Android (react-native-tvos) : il ne
 *  s'applique qu'à une transition faux → vrai, ce que les réclamations du
 *  magasin font déjà. */
export function withPreferredFocus(binding: FocusBinding, preferred: boolean | undefined): FocusBinding {
  return preferred === undefined ? binding : { ...binding, native: { hasTVPreferredFocus: preferred } };
}

/** La liaison d'une croix verrouillée. */
export function withExitLock(binding: FocusBinding): FocusBinding {
  return { ...binding, ...END_EXIT_LOCK };
}
