import { useCallback, useEffect, useState } from "react";
import {
  RAIL_SETUP_ACTIONS_ENTRY,
  RAIL_SETUP_ACTIONS_GROUP,
  isRailSetupActionKey,
  railSetupGuardedKeys,
  railSetupLockedKeys,
  railSetupMoveKey,
} from "@tentacle-tv/tv-core";
import { claimAfterRestore } from "../focus/claimAfterRestore";
import { createEntryGuide } from "../focus/entryGuide";
import { setFocusLocked } from "../focus/focusLocks";
import type { FocusStore } from "../focus/focusStore";

/**
 * L'applicateur de la PRÉCONFIGURATION de la barre (Apple TV ; Android TV
 * par les variantes `.android` du focus) — les décisions sont celles de
 * tv-core (`nav/railSetupScreen.ts`, `nav/railSetupApply.ts`, `nav/arrange.ts`) ;
 * ce module ne fait que les poser : la garde du clic fantôme, l'entrée
 * réclamée, le pied qui s'entre par « Continuer », les verrous d'un
 * déplacement et la case rendue après une annulation.
 */

/** Les liaisons naissent avec l'écran, avant son premier rendu. */
export function useRailSetupGroups(store: FocusStore): void {
  useState(() => {
    // La page paraît sous l'OK qui l'a ouverte : seul un OK commencé sur une de ses cibles y vaut.
    for (const key of railSetupGuardedKeys()) store.bind(key, { phantomPressGuard: true });
    // BAS depuis la liste : « Continuer », jamais le plus proche du centre de la ligne (« Passer »).
    store.bind(RAIL_SETUP_ACTIONS_GROUP, {
      container: createEntryGuide(store, { owns: isRailSetupActionKey, fallback: () => RAIL_SETUP_ACTIONS_ENTRY, remember: false }),
    });
  });
}

/** L'entrée de l'étape affichée, réclamée à chaque changement. */
export function useRailSetupEntry(store: FocusStore, entryKey: string | null): void {
  useEffect(() => (entryKey ? store.claim(entryKey) : undefined), [entryKey, store]);
}

/** Ce que le déplacement d'une bibliothèque pose sur le focus. */
export function useRailSetupMoveFocus(store: FocusStore) {
  /** Pendant un déplacement, seules les pastilles « Déplacer » restent focalisables. */
  const lockOthers = useCallback(
    (locked: boolean, rowCount: number) => {
      for (const key of railSetupLockedKeys(rowCount)) setFocusLocked(store, key, locked);
    },
    [store],
  );
  /** Retour a annulé le déplacement : le focus revient à la pastille de départ. */
  const returnToSlot = useCallback((slot: number) => claimAfterRestore(store, railSetupMoveKey(slot)), [store]);
  return { lockOthers, returnToSlot };
}
