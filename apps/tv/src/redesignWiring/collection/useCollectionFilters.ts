import { useCallback, useMemo, useState } from "react";
import type { TFunction } from "i18next";
import { filterCollection } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import {
  applyCollectionOption,
  clearCollectionCriterion,
  clearCollectionFilters,
  collectionFocusAfterClearAll,
  DEFAULT_COLLECTION_FILTERS,
  removeCollectionFilter,
  type CollectionFilterState,
} from "@tentacle-tv/tv-core";
import type { FocusStore } from "../../platform/tvos/focus/focusStore";
import { useLibraryGroups } from "../../platform/tvos/screens/library";
import type { LibraryFilterKey } from "../../redesign/screens/library/libraryTypes";
import { useFilterBar, type FilterBarModel } from "../library/useLibraryFilterBar";
import { useFilterSheets } from "../library/useFilterSheets";
import { collectionActiveOf, collectionPillsOf, collectionSheetOf } from "./collectionFilterModel";

export type CollectionKind = "watchlist" | "favorites";

/** La mémoire de session, PAR liste — comme celle des bibliothèques
 *  (`libraryCatalogParams`) : revenir sur Ma liste retrouve son tri,
 *  redémarrer l'app l'oublie. Jamais sur le disque. */
const memory = new Map<CollectionKind, CollectionFilterState>();

const NO_ITEMS: MediaItem[] = [];

/**
 * Le type et le tri d'une collection (CO-3) : l'état, retenu pour la session,
 * et la liste rangée — EN MÉMOIRE par `filterCollection`, la règle du bureau
 * et du mobile : la liste est chargée d'un bloc, sous la clé du cache
 * optimiste, qu'une source paginée casserait.
 */
export function useCollectionSort(kind: CollectionKind, items: MediaItem[] | undefined) {
  const [state, setState] = useState<CollectionFilterState>(() => memory.get(kind) ?? DEFAULT_COLLECTION_FILTERS);
  const update = useCallback((effect: (s: CollectionFilterState) => CollectionFilterState) => {
    setState((current) => {
      const next = effect(current);
      memory.set(kind, next);
      return next;
    });
  }, [kind]);

  const listOf = useCallback(
    (type: CollectionFilterState["type"]) =>
      filterCollection(items ?? NO_ITEMS, {
        search: "",
        type,
        genres: [],
        yearFrom: null,
        yearTo: null,
        ratingMin: null,
        statusFilter: null,
        sortBy: state.sortBy,
        sortOrder: state.sortOrder,
      }),
    [items, state.sortBy, state.sortOrder],
  );
  const visible = useMemo(() => listOf(state.type), [listOf, state.type]);
  // Ce que « Tout effacer » laissera (le type retiré ; tri et rangement gardés) : sa première
  // carte est celle que le focus vise depuis le vide des filtres trop serrés.
  const cleared = useMemo(() => (state.type === "all" ? visible : listOf("all")), [state.type, visible, listOf]);
  return { state, update, visible, cleared };
}

export type CollectionSort = ReturnType<typeof useCollectionSort>;

/**
 * La barre (Type, Trier par) et ses listes (CO-3, CO-4), avec les gestes et
 * le focus de la bibliothèque : mêmes groupes, même pied, même Retour, même
 * pastille rendue.
 */
export function useCollectionFilterBar(t: TFunction, sort: CollectionSort, focus: FocusStore, first?: string) {
  const { state, update, visible } = sort;
  useLibraryGroups(focus);
  const count = visible.length;
  const sheetModel = useMemo(
    () => ({
      sheetOf: (key: LibraryFilterKey, s: CollectionFilterState) => collectionSheetOf(t, key, s, count),
      apply: applyCollectionOption,
      clear: clearCollectionCriterion,
    }),
    [t, count],
  );
  const sheets = useFilterSheets(state, update, focus, sheetModel);
  const pills = useMemo(() => collectionPillsOf(t, state), [t, state]);
  const active = useMemo(() => collectionActiveOf(t, state), [t, state]);
  const labels = useMemo(() => ({ activeFilters: t("library:activeFilters"), clearAll: t("library:clearAll") }), [t]);
  const model = useMemo<FilterBarModel<CollectionFilterState>>(
    () => ({
      toggleOf: () => null,
      remove: removeCollectionFilter,
      clearAll: clearCollectionFilters,
      focusAfterClearAll: (key) => collectionFocusAfterClearAll(key, first),
    }),
    [first],
  );
  const bar = useFilterBar(update, active, focus, sheets.openSheet, model);
  return { pills, active, labels, sheets, bar };
}
