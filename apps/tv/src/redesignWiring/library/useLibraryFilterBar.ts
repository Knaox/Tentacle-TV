import { useCallback, useRef } from "react";
import { filterPillPress } from "@tentacle-tv/tv-core";
import { DEFAULT_FILTERS, type LibraryFilterState } from "../../hooks/libraryCatalogParams";
import type { FocusStore } from "../../platform/tvos/focus/focusStore";
import { useFilterBarFocus } from "../../platform/tvos/screens/library";
import type { ActiveFilterModel, LibraryFilterKey } from "../../redesign/screens/library/libraryTypes";
import { removeFilter, toggleFavorites } from "./libraryFilterModel";

type Update = (effect: (f: LibraryFilterState) => LibraryFilterState) => void;

/**
 * Les gestes de la barre de filtres : une pastille ouvre sa liste (Favoris
 * bascule), une croix retire son filtre, « Tout effacer » les retire tous.
 *
 * Retirer, c'est démonter ce qu'on vient d'actionner : sans réclamation, le
 * focus tombait où tvOS voulait — le rail, souvent. Il va donc au filtre qui
 * prend la place (sinon au précédent) ; la rangée vidée, à la pastille du
 * critère retiré. « Tout effacer » rend la pastille de tête ; depuis le vide
 * de « Aucun titre ne correspond », la première affiche revenue. Décidé par
 * tv-core (`focus/libraryFocus.ts`), posé par l'applicateur tvOS.
 */
export function useLibraryFilterBar(update: Update, active: ActiveFilterModel[], focus: FocusStore, openSheet: (key: LibraryFilterKey) => void) {
  const activeRef = useRef(active);
  activeRef.current = active;
  const { afterRemove, clearAllTarget, claim } = useFilterBarFocus(focus);

  const onPressPill = useCallback((key: LibraryFilterKey) => {
    if (filterPillPress(key) === "toggleFavorites") update(toggleFavorites);
    else openSheet(key);
  }, [update, openSheet]);

  const onRemoveFilter = useCallback((id: string) => {
    const ids = activeRef.current.map((filter) => filter.id);
    update((f) => removeFilter(f, id));
    afterRemove(ids, id);
  }, [update, afterRemove]);

  const onClearAll = useCallback(() => {
    const target = clearAllTarget();
    update(() => DEFAULT_FILTERS);
    claim(target);
  }, [update, clearAllTarget, claim]);

  return { onPressPill, onRemoveFilter, onClearAll };
}
