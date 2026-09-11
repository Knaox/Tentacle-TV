import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { collectionGenres, filterCollection, type CollectionTypeTab } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { usePlatformFilter } from "@/hooks/usePlatformFilter";

export type { CollectionTypeTab };

/**
 * Les mêmes filtres que sur le bureau, appliqués à Ma liste et Mes favoris.
 *
 * LE MÊME `filterCollection` que le web — c'est le point : les deux plateformes
 * ne peuvent pas diverger sur ce que « en cours » veut dire, ni sur l'ordre d'un
 * tri. Seule la façon de tenir l'état change : ici un `useState`, là-bas
 * l'adresse, puisqu'il n'y a pas d'adresse à partager sur un téléphone.
 *
 * Quatre tris seulement, ceux du bureau. Le catalogue mobile en propose huit,
 * qui sont des chaînes de tri SERVEUR ; ici tout se trie en mémoire, et deux
 * vocabulaires pour la même action finiraient par se contredire.
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

const DEFAUT: CollectionFilterState = {
  search: "",
  type: "all",
  genres: [],
  yearFrom: null,
  yearTo: null,
  ratingMin: null,
  statusFilter: null,
  platformIds: [],
  sortBy: "DateCreated",
  sortOrder: "Descending",
};

export function useCollectionFilters(items: MediaItem[] | undefined) {
  const { t } = useTranslation("common");
  const [state, setState] = useState<CollectionFilterState>(DEFAUT);
  const [input, setInput] = useState("");

  // Le champ répond à la frappe, le filtre attend 300 ms — comme le catalogue.
  useEffect(() => {
    const timer = setTimeout(() => {
      setState((s) => (s.search === input.trim() ? s : { ...s, search: input.trim() }));
    }, 300);
    return () => clearTimeout(timer);
  }, [input]);

  const patch = (p: Partial<CollectionFilterState>) => setState((s) => ({ ...s, ...p }));
  const reset = () => {
    setState((s) => ({ ...DEFAUT, search: s.search, type: s.type }));
  };

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

  const { filteredItems: visible } = usePlatformFilter(filtered, state.platformIds);

  const activeCount =
    (state.genres.length > 0 ? 1 : 0) +
    (state.platformIds.length > 0 ? 1 : 0) +
    (state.yearFrom != null || state.yearTo != null ? 1 : 0) +
    (state.ratingMin != null ? 1 : 0) +
    (state.statusFilter ? 1 : 0) +
    (state.sortBy !== DEFAUT.sortBy || state.sortOrder !== DEFAUT.sortOrder ? 1 : 0);

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
    isFiltered: activeCount > 0 || state.type !== "all" || state.search.trim().length >= 2,
  };
}

export type CollectionFiltersApi = ReturnType<typeof useCollectionFilters>;
