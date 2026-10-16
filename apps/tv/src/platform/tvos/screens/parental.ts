import { useEffect, useState } from "react";
import { PARENTAL_AGES_SECTION, PARENTAL_BACK_BAR_KEY, PARENTAL_BACK_KEY, parentalGuardedKeys } from "@tentacle-tv/tv-core";
import { useBackFocus } from "../back/backFocus";
import type { FocusStore } from "../focus/focusStore";
import { useSectionEntry } from "../focus/sectionEntry";

/**
 * L'applicateur du CONTRÔLE PARENTAL simplifié (Apple TV ; Android TV par les
 * variantes `.android` du focus) — les décisions sont celles de tv-core
 * (`focus/parentalFocus.ts`) ; ce module ne fait que les poser : la garde du
 * clic fantôme, la croix reverrouillée à chaque arrivée, l'entrée réclamée et
 * la rangée des paliers qui entre par le palier retenu. HAUT / BAS d'une
 * section à l'autre : la règle commune des sections (`FocusSection`).
 */

/** Les liaisons naissent avec l'écran, avant son premier rendu. */
export function useParentalGroups(store: FocusStore): void {
  useState(() => {
    // La page paraît sous l'OK qui l'a ouverte : seul un OK commencé sur une de ses cibles y vaut.
    for (const key of parentalGuardedKeys()) store.bind(key, { phantomPressGuard: true });
  });
}

/** La croix et l'entrée de la page ; les paliers entrent par celui qui est retenu (`agesEntry`). */
export function useParentalFocus(
  store: FocusStore,
  { entryKey, arrival, agesEntry }: { entryKey: string | null; arrival: string; agesEntry: string | null },
): void {
  useBackFocus(store, { backKey: PARENTAL_BACK_KEY, barKey: PARENTAL_BACK_BAR_KEY, entryKey, arrival });
  useEffect(() => (entryKey ? store.claim(entryKey) : undefined), [entryKey, store]);
  useSectionEntry(store, PARENTAL_AGES_SECTION, agesEntry);
}
