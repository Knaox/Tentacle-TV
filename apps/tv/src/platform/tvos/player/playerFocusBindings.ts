import type { FocusBinding } from "../../../redesign/focus/focusBinding";
import { FOCUS_LOCKED } from "../focus/focusLocks";
import type { FocusExtras } from "../focus/focusStore";

/**
 * Ce que le port pose sur les clés du lecteur, en natif — l'APPLICATION des
 * règles de tv-core (`player/playerFocus.ts`) : la préférence d'origine d'une
 * entrée (`preferredFocusOf`) et la croix verrouillée (`exitLocked`).
 */

/** La croix verrouillée : le verrou de la plateforme (`focusLocks`). */
export const END_EXIT_LOCK: FocusExtras = FOCUS_LOCKED;

/** La liaison avec sa préférence d'origine ; `undefined` : celle de toujours. */
export function withPreferredFocus(binding: FocusBinding, preferred: boolean | undefined): FocusBinding {
  return preferred === undefined ? binding : { ...binding, native: { hasTVPreferredFocus: preferred } };
}

/** La liaison d'une croix verrouillée. */
export function withExitLock(binding: FocusBinding): FocusBinding {
  return { ...binding, ...END_EXIT_LOCK };
}
