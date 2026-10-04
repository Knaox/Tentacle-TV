import { useEffect, useState } from "react";
import {
  GUEST_COLORS_GROUP,
  INVITE_RESULTS_GROUP,
  MANAGE_ACTIONS_GROUP,
  MANAGE_BACK_BAR_KEY,
  MANAGE_BACK_KEY,
  MANAGE_ROWS_GROUP,
  PIN_PAD_GROUP,
  PROFILES_ACTIONS_GROUP,
  PROFILES_BACK_BAR_KEY,
  PROFILES_BACK_KEY,
  PROFILES_TILES_GROUP,
} from "@tentacle-tv/tv-core";
import { useBackFocus } from "../back/backFocus";
import { AutoFocusGuide } from "../focus/focusGuides";
import type { FocusStore } from "../focus/focusStore";

/**
 * L'applicateur tvOS des PROFILS (Famille) — « Qui regarde ? », le pavé du
 * code PIN, « Gérer les profils ». Les décisions sont celles de tv-core
 * (`focus/profilesFocus.ts`, `nav/profilesBack.ts`) ; ce module ne fait que
 * les poser : les guides qui mémorisent (la rangée des profils, ses actions,
 * le pavé, les lignes de la gestion), la croix Retour reverrouillée à chaque
 * étape, et l'entrée réclamée.
 */

/** Les guides naissent avec l'écran, avant son premier rendu : un groupe se lie dès qu'il paraît. */
export function useProfilesGroups(store: FocusStore): void {
  useState(() => {
    store.bind(PROFILES_TILES_GROUP, { container: AutoFocusGuide });
    store.bind(PROFILES_ACTIONS_GROUP, { container: AutoFocusGuide });
    store.bind(PIN_PAD_GROUP, { container: AutoFocusGuide });
  });
}

/** La croix (reverrouillée à chaque étape, `arrival`) et l'entrée, réclamée à chaque changement. */
export function useProfilesFocus(store: FocusStore, { entryKey, arrival }: { entryKey: string | null; arrival: string }): void {
  useBackFocus(store, { backKey: PROFILES_BACK_KEY, barKey: PROFILES_BACK_BAR_KEY, entryKey, arrival });
  useEffect(() => (entryKey ? store.claim(entryKey) : undefined), [entryKey, store]);
}

/** « Gérer les profils » : ses guides, sa croix et son entrée. */
export function useManageGroups(store: FocusStore): void {
  useState(() => {
    store.bind(MANAGE_ACTIONS_GROUP, { container: AutoFocusGuide });
    store.bind(MANAGE_ROWS_GROUP, { container: AutoFocusGuide });
    store.bind(GUEST_COLORS_GROUP, { container: AutoFocusGuide });
    store.bind(INVITE_RESULTS_GROUP, { container: AutoFocusGuide });
  });
}

export function useManageFocus(store: FocusStore, { entryKey, arrival }: { entryKey: string | null; arrival: string }): void {
  useBackFocus(store, { backKey: MANAGE_BACK_KEY, barKey: MANAGE_BACK_BAR_KEY, entryKey, arrival });
  useEffect(() => (entryKey ? store.claim(entryKey) : undefined), [entryKey, store]);
}
