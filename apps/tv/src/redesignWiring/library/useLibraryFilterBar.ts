import { useCallback, useRef } from "react";
import { DEFAULT_FILTERS, type LibraryFilterState } from "../../hooks/libraryCatalogParams";
import type { ActiveFilterModel, LibraryFilterKey } from "../../redesign/screens/library/libraryTypes";
import type { FocusStore } from "../focus/focusStore";
import { removeFilter, toggleFavorites } from "./libraryFilterModel";

type Update = (effect: (f: LibraryFilterState) => LibraryFilterState) => void;

/** Le critère d'un filtre actif : sa pastille, où revenir quand la rangée disparaît. */
function criterionOf(id: string): LibraryFilterKey {
  if (id.startsWith("genre:")) return "genres";
  if (id.startsWith("platform:")) return "platforms";
  return id as LibraryFilterKey;
}

/**
 * Les gestes de la barre de filtres : une pastille ouvre sa liste (Favoris
 * bascule), une croix retire son filtre, « Tout effacer » les retire tous.
 *
 * Retirer, c'est démonter ce qu'on vient d'actionner : sans réclamation, le
 * focus tombait où tvOS voulait — le rail, souvent. Il va donc au filtre qui
 * prend la place (sinon au précédent) ; la rangée vidée, à la pastille du
 * critère retiré. « Tout effacer » rend la pastille de tête ; depuis le vide
 * de « Aucun titre ne correspond », la première affiche revenue.
 */
export function useLibraryFilterBar(update: Update, active: ActiveFilterModel[], focus: FocusStore, openSheet: (key: LibraryFilterKey) => void) {
  const activeRef = useRef(active);
  activeRef.current = active;

  const onPressPill = useCallback((key: LibraryFilterKey) => {
    if (key === "favorites") update(toggleFavorites);
    else openSheet(key);
  }, [update, openSheet]);

  const onRemoveFilter = useCallback((id: string) => {
    const ids = activeRef.current.map((filter) => filter.id);
    const index = ids.indexOf(id);
    const remaining = ids.length - 1;
    update((f) => removeFilter(f, id));
    focus.claim(remaining > 0 ? `active:${Math.min(Math.max(0, index), remaining - 1)}` : `pill:${criterionOf(id)}`);
  }, [update, focus]);

  const onClearAll = useCallback(() => {
    const fromEmpty = focus.focusedKey() === "empty:primary";
    update(() => DEFAULT_FILTERS);
    focus.claim(fromEmpty ? "grid:0" : "pill:status");
  }, [update, focus]);

  return { onPressPill, onRemoveFilter, onClearAll };
}
