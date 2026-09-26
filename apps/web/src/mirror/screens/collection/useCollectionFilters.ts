import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { collectionGenres, filterCollection, type CollectionTypeTab } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { usePlatformFilter } from "../../../hooks/usePlatformFilter";
import { DEFAULT_COLLECTION_SORT } from "../../catalog/catalogOptions";

/**
 * Les filtres de Ma liste et de Mes favoris (`screens/collection/useCollectionFilters`
 * de l'app) : LE MÊME `filterCollection` que le bureau — les plateformes ne
 * peuvent pas diverger sur ce que « en cours » veut dire. Comme l'app, un
 * état local (pas l'adresse) ; quatre tris en mémoire.
 */
export interface CollectionFilterState {
  search: string;
  type: CollectionTypeTab;
  genres: string[];
  yearFrom: number | null;
  yearTo: number | null;
  ratingMin: number | null;
  statusFilter: string | null;
  platformIds: number[];
  sortBy: string;
  sortOrder: string;
}

const DEFAULT_STATE: CollectionFilterState = {
  search: "",
  type: "all",
  genres: [],
  yearFrom: null,
  yearTo: null,
  ratingMin: null,
  statusFilter: null,
  platformIds: [],
  sortBy: DEFAULT_COLLECTION_SORT.sortBy,
  sortOrder: DEFAULT_COLLECTION_SORT.sortOrder,
};

/** Le nombre du bouton « Trier et filtrer » : une famille compte une fois, le tri s'il n'est pas le défaut. */
export function collectionActiveCount(s: CollectionFilterState): number {
  return (s.genres.length > 0 ? 1 : 0)
    + (s.platformIds.length > 0 ? 1 : 0)
    + (s.yearFrom != null || s.yearTo != null ? 1 : 0)
    + (s.ratingMin != null ? 1 : 0)
    + (s.statusFilter ? 1 : 0)
    + (s.sortBy !== DEFAULT_STATE.sortBy || s.sortOrder !== DEFAULT_STATE.sortOrder ? 1 : 0);
}

export function useCollectionFilters(items: MediaItem[] | undefined) {
  const { t } = useTranslation("common");
  const [state, setState] = useState<CollectionFilterState>(DEFAULT_STATE);
  const [input, setInput] = useState("");

  // Le champ répond à la frappe, le filtre attend 300 ms — comme le catalogue.
  useEffect(() => {
    const timer = setTimeout(() => {
      setState((s) => (s.search === input.trim() ? s : { ...s, search: input.trim() }));
    }, 300);
    return () => clearTimeout(timer);
  }, [input]);

  const patch = (p: Partial<CollectionFilterState>) => setState((s) => ({ ...s, ...p }));
  // « Réinitialiser » garde la recherche et l'onglet de type.
  const reset = () => setState((s) => ({ ...DEFAULT_STATE, search: s.search, type: s.type }));

  const genres = useMemo(() => collectionGenres(items ?? []), [items]);
  const filtered = useMemo(
    () =>
      filterCollection(items ?? [], {
        search: state.search,
        type: state.type,
        genres: state.genres,
        yearFrom: state.yearFrom,
        yearTo: state.yearTo,
        ratingMin: state.ratingMin,
        statusFilter: state.statusFilter,
        sortBy: state.sortBy,
        sortOrder: state.sortOrder,
      }),
    [items, state],
  );
  // Une copie : le filtre des plateformes trie sur place la liste qu'on lui passe.
  const platformIds = useMemo(() => [...state.platformIds], [state.platformIds]);
  const { filteredItems: visible } = usePlatformFilter(filtered, platformIds);
  const activeCount = collectionActiveCount(state);

  const tabs: { key: CollectionTypeTab; label: string }[] = [
    { key: "all", label: t("allFilter") },
    { key: "Movie", label: t("moviesFilter") },
    { key: "Series", label: t("seriesFilter") },
  ];

  return {
    state,
    patch,
    reset,
    input,
    setInput,
    tabs,
    genres,
    filtered: visible,
    resultCount: visible.length,
    activeCount,
  };
}

export type CollectionFiltersApi = ReturnType<typeof useCollectionFilters>;
