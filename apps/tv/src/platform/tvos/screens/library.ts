import { useCallback, useEffect, useRef, useState } from "react";
import {
  LIBRARY_EMPTY_ACTION,
  LIBRARY_EMPTY_GROUP,
  LIBRARY_FILTERS_GROUP,
  SHEET_APPLY_KEY,
  SHEET_FOOTER_GROUP,
  filterFocusAfterClearAll,
  filterFocusAfterRemove,
  filterPillKey,
  isLibraryEmptyKey,
  isNavKey,
  isSheetFooterKey,
  libraryClaimAfterLoad,
  libraryFocusMoved,
  filterSheetFocusKeys,
  type FilterSheetShape,
} from "@tentacle-tv/tv-core";
import { createEntryGuide } from "../focus/entryGuide";
import { AutoFocusGuide } from "../focus/focusGuides";
import type { FocusStore } from "../focus/focusStore";
import { useChoiceEntry } from "../panels/useChoiceEntry";

/**
 * L'applicateur tvOS de la BIBLIOTHÈQUE — les décisions sont celles de
 * tv-core (`focus/libraryFocus.ts`, relevé BI-1 à BI-12) ; ce module ne fait
 * que les poser : les guides de la barre de filtres, du vide et du pied des
 * listes, les réclamations (première affiche après le premier chargement,
 * filtre qui prend la place, pastille rendue), le verrou d'entrée des listes
 * en Modal (`useChoiceEntry`, règle de T6).
 */

/** La barre de filtres (qui mémorise) et le vide des filtres trop serrés (BAS y entre par « Tout effacer »). */
export function useLibraryGroups(focus: FocusStore): void {
  useState(() => {
    focus.bind(LIBRARY_FILTERS_GROUP, { container: AutoFocusGuide });
    focus.bind(LIBRARY_EMPTY_GROUP, { container: createEntryGuide(focus, { owns: isLibraryEmptyKey, fallback: () => LIBRARY_EMPTY_ACTION }) });
    return true;
  });
}

/**
 * Premier chargement : la pastille de tête a tenu le focus ; les affiches
 * arrivées, la première le reprend — si personne n'a bougé entre-temps.
 */
export function useLibraryLoadReprise(focus: FocusStore, state: { loading: boolean; items: number }): void {
  const moved = useRef(false);
  useEffect(() => focus.subscribe((key, focused) => {
    if (focused && libraryFocusMoved(key, isNavKey(key))) moved.current = true;
  }), [focus]);
  const { loading, items } = state;
  useEffect(() => {
    const target = libraryClaimAfterLoad({ loading, items, moved: moved.current, focusedKey: focus.focusedKey() });
    return target ? focus.claim(target) : undefined;
  }, [loading, items, focus]);
}

/** Le focus après un geste de la barre : retirer un filtre, tout effacer. */
export function useFilterBarFocus(focus: FocusStore) {
  const afterRemove = useCallback((activeIds: readonly string[], removedId: string) => {
    focus.claim(filterFocusAfterRemove(activeIds, removedId));
  }, [focus]);
  /** À lire AVANT d'effacer : d'où vient le geste. */
  const clearAllTarget = useCallback(() => filterFocusAfterClearAll(focus.focusedKey()), [focus]);
  const claim = useCallback((key: string) => {
    focus.claim(key);
  }, [focus]);
  return { afterRemove, clearAllTarget, claim };
}

const NO_KEYS: string[] = [];

/**
 * Le focus d'une grande liste ouverte : son pied (BAS y entre par « Voir N
 * titres »), son entrée — seule focalisable à l'ouverture, une Modal
 * n'honorant aucune préférence —, et la pastille rendue une fois la liste
 * effacée.
 */
export function useFilterSheetFocus(focus: FocusStore, sheet: FilterSheetShape | null, entryKey: string | null) {
  // Le pied de la liste, lié avant le premier rendu d'une liste.
  useState(() => focus.bind(SHEET_FOOTER_GROUP, { container: createEntryGuide(focus, { owns: isSheetFooterKey, fallback: () => SHEET_APPLY_KEY }) }));
  useChoiceEntry(focus, sheet ? filterSheetFocusKeys(sheet) : NO_KEYS, entryKey);
  const returnToPill = useCallback((filter: string) => {
    focus.claim(filterPillKey(filter));
  }, [focus]);
  return { returnToPill };
}
