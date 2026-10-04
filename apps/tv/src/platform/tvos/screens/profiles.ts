import { useEffect, useState } from "react";
import {
  GUEST_COLORS_GROUP,
  MANAGE_BACK_BAR_KEY,
  MANAGE_BACK_KEY,
  PROFILES_BACK_BAR_KEY,
  PROFILES_BACK_KEY,
  guestColorsEntryKey,
  manageGuardedKeys,
  profilesGuardedKeys,
} from "@tentacle-tv/tv-core";
import { useBackFocus } from "../back/backFocus";
import type { FocusStore } from "../focus/focusStore";
import { useSectionEntry } from "../focus/sectionEntry";

/**
 * L'applicateur tvOS des PROFILS (Famille) — « Qui regarde ? », le pavé du
 * code PIN, « Gérer les profils ». Les décisions sont celles de tv-core
 * (`focus/profilesFocus.ts`, `nav/profilesBack.ts`) ; ce module ne fait que
 * les poser : la garde du clic fantôme, la croix Retour reverrouillée à
 * chaque étape, et l'entrée réclamée. HAUT / BAS d'une rangée à l'autre :
 * les SECTIONS des vues (`FocusSection`), la règle commune des autres pages
 * (tv-core `focus/sections`, au plus proche) — plus de guides qui mémorisent.
 */

/** Les liaisons naissent avec l'écran, avant son premier rendu. */
export function useProfilesGroups(store: FocusStore): void {
  useState(() => {
    // La page change sous un OK encore enfoncé : seul l'OK commencé sur une cible y vaut.
    for (const key of profilesGuardedKeys()) store.bind(key, { phantomPressGuard: true });
  });
}

/** La croix (reverrouillée à chaque étape, `arrival`) et l'entrée, réclamée à chaque changement. */
export function useProfilesFocus(store: FocusStore, { entryKey, arrival }: { entryKey: string | null; arrival: string }): void {
  useBackFocus(store, { backKey: PROFILES_BACK_KEY, barKey: PROFILES_BACK_BAR_KEY, entryKey, arrival });
  useEffect(() => (entryKey ? store.claim(entryKey) : undefined), [entryKey, store]);
}

/** « Gérer les profils » : la garde du clic fantôme ; sa croix et son entrée (`useManageFocus`). */
export function useManageGroups(store: FocusStore): void {
  useState(() => {
    for (const key of manageGuardedKeys()) store.bind(key, { phantomPressGuard: true });
  });
}

export function useManageFocus(store: FocusStore, { entryKey, arrival }: { entryKey: string | null; arrival: string }): void {
  useBackFocus(store, { backKey: MANAGE_BACK_KEY, barKey: MANAGE_BACK_BAR_KEY, entryKey, arrival });
  useEffect(() => (entryKey ? store.claim(entryKey) : undefined), [entryKey, store]);
}

/** La rangée des couleurs d'un invité entre par la couleur choisie (tv-core `guestColorsEntryKey`). */
export function useGuestColorsEntry(store: FocusStore, selected: string | null): void {
  useSectionEntry(store, GUEST_COLORS_GROUP, selected ? guestColorsEntryKey(selected) : null);
}
