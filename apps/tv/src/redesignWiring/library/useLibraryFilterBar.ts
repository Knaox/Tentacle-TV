import { useCallback, useMemo, useRef } from "react";
import { filterFocusAfterClearAll, filterPillPress } from "@tentacle-tv/tv-core";
import { DEFAULT_FILTERS, type LibraryFilterState } from "../../hooks/libraryCatalogParams";
import type { FocusStore } from "../../platform/tvos/focus/focusStore";
import { useFilterBarFocus } from "../../platform/tvos/screens/library";
import type { ActiveFilterModel, LibraryFilterKey } from "../../redesign/screens/library/libraryTypes";
import { removeFilter, toggleFavorites } from "./libraryFilterModel";
import type { FilterUpdate } from "./useFilterSheets";

/** Ce qu'une barre fait de ses gestes — pur, sans React. */
export interface FilterBarModel<S> {
  /** OK sur une pastille : une bascule (son effet), sinon `null` — sa liste s'ouvre. */
  toggleOf: (key: LibraryFilterKey) => ((state: S) => S) | null;
  /** La croix d'un filtre actif. */
  remove: (state: S, id: string) => S;
  /** « Tout effacer ». */
  clearAll: (state: S) => S;
  /** Où va le focus après « Tout effacer », d'après la clé focalisée au geste. */
  focusAfterClearAll: (focusedKey: string | null) => string;
}

/**
 * Les gestes d'une barre de filtres : une pastille ouvre sa liste (une
 * bascule change l'état), une croix retire son filtre, « Tout effacer » les
 * retire tous.
 *
 * Retirer, c'est démonter ce qu'on vient d'actionner : sans réclamation, le
 * focus tombait où tvOS voulait — le rail, souvent. Il va donc au filtre qui
 * prend la place (sinon au précédent) ; la rangée vidée, à la pastille du
 * critère retiré. « Tout effacer » rend la pastille de tête ; depuis le vide
 * de « Aucun titre ne correspond », la première affiche revenue. Décidé par
 * tv-core (`focus/libraryFocus.ts`, `focus/collectionFilters.ts`), posé par
 * l'applicateur tvOS.
 */
export function useFilterBar<S>(
  update: FilterUpdate<S>,
  active: ActiveFilterModel[],
  focus: FocusStore,
  openSheet: (key: LibraryFilterKey) => void,
  model: FilterBarModel<S>,
) {
  const activeRef = useRef(active);
  activeRef.current = active;
  const modelRef = useRef(model);
  modelRef.current = model;
  const { afterRemove, clearAllTarget, claim } = useFilterBarFocus(focus);

  const onPressPill = useCallback((key: LibraryFilterKey) => {
    const toggle = modelRef.current.toggleOf(key);
    if (toggle) update(toggle);
    else openSheet(key);
  }, [update, openSheet]);

  const onRemoveFilter = useCallback((id: string) => {
    const ids = activeRef.current.map((filter) => filter.id);
    update((s) => modelRef.current.remove(s, id));
    afterRemove(ids, id);
  }, [update, afterRemove]);

  const onClearAll = useCallback(() => {
    const target = clearAllTarget(modelRef.current.focusAfterClearAll);
    update((s) => modelRef.current.clearAll(s));
    claim(target);
  }, [update, clearAllTarget, claim]);

  return { onPressPill, onRemoveFilter, onClearAll };
}

/** La barre de la bibliothèque ; `first` : la première carte (la grille, ou la première rangée). */
function libraryBar(first?: string): FilterBarModel<LibraryFilterState> {
  return {
    toggleOf: (key) => (filterPillPress(key) === "toggleFavorites" ? toggleFavorites : null),
    remove: removeFilter,
    // « Ranger par » n'est pas un filtre : il reste.
    clearAll: (f) => ({ ...DEFAULT_FILTERS, groupBy: f.groupBy }),
    focusAfterClearAll: (key) => filterFocusAfterClearAll(key, first),
  };
}

/** La barre de la bibliothèque : Favoris bascule, « Tout effacer » rend les défauts. */
export function useLibraryFilterBar(
  update: FilterUpdate<LibraryFilterState>,
  active: ActiveFilterModel[],
  focus: FocusStore,
  openSheet: (key: LibraryFilterKey) => void,
  first?: string,
) {
  const model = useMemo(() => libraryBar(first), [first]);
  return useFilterBar(update, active, focus, openSheet, model);
}
