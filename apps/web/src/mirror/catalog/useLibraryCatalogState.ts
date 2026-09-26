import { useEffect, useMemo, useState } from "react";
import { useLibraryCatalog } from "@tentacle-tv/api-client";
import { usePlatformFilter } from "../../hooks/usePlatformFilter";
import {
  DEFAULT_ADVANCED,
  SORT_OPTIONS,
  advancedCount,
  catalogFilterCount,
  toggleIn,
  yearsParam,
  type AdvancedFilters,
} from "./catalogOptions";

/**
 * Tout l'état d'un catalogue de bibliothèque (`screens/library/useLibraryCatalogState`
 * de l'app) — recherche, genres, tri, années, statut, plateformes, note,
 * favoris — et la requête qui en découle. Partagé par l'onglet Bibliothèque
 * et l'écran d'une bibliothèque, au geste près.
 *
 * Comme l'app : un état local, pas l'adresse. Une autre bibliothèque repart
 * de zéro, sauf le tri et le statut (des préférences plus que des filtres) —
 * remis pendant le rendu, aucune requête ne part avec les filtres d'avant.
 */
export function useLibraryCatalogState(libraryId: string) {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [platformIds, setPlatformIds] = useState<number[]>([]);
  const [sortIndex, setSortIndex] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>(DEFAULT_ADVANCED);

  const [scope, setScope] = useState(libraryId);
  if (scope !== libraryId) {
    setScope(libraryId);
    setSearchQuery("");
    setDebouncedSearch("");
    setSelectedGenres([]);
    setPlatformIds([]);
    setSheetOpen(false);
    setAdvancedFilters(DEFAULT_ADVANCED);
  }

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const years = useMemo(
    () => yearsParam(advancedFilters.yearFrom, advancedFilters.yearTo),
    [advancedFilters.yearFrom, advancedFilters.yearTo],
  );
  const platformActive = platformIds.length > 0;

  const catalog = useLibraryCatalog(libraryId, {
    sortBy: SORT_OPTIONS[sortIndex].sortBy,
    sortOrder: SORT_OPTIONS[sortIndex].sortOrder,
    genreIds: selectedGenres.length > 0 ? selectedGenres : undefined,
    years,
    statusFilter: statusFilter ?? undefined,
    searchTerm: debouncedSearch.length >= 2 ? debouncedSearch : undefined,
    studioIds: advancedFilters.studioIds.length > 0 ? advancedFilters.studioIds : undefined,
    minCommunityRating: advancedFilters.ratingMin ?? undefined,
    isFavorite: advancedFilters.isFavorite || undefined,
    // Le filtre des plateformes se fait en mémoire : il lui faut large.
    limit: platformActive ? 500 : undefined,
  });

  const allItems = useMemo(() => catalog.data?.pages.flatMap((p) => p.Items) ?? [], [catalog.data]);
  // Une copie : le filtre trie la liste qu'on lui passe, sur place.
  const platformKey = useMemo(() => [...platformIds], [platformIds]);
  const { filteredItems: platformFiltered } = usePlatformFilter(allItems, platformKey);
  const items = platformActive ? platformFiltered : allItems;
  const totalCount = platformActive ? platformFiltered.length : (catalog.data?.pages[0]?.TotalRecordCount ?? 0);
  const searching = debouncedSearch.length >= 2;
  const advancedActive = advancedCount(advancedFilters);
  const isFiltered = searching || selectedGenres.length > 0 || statusFilter !== null || advancedActive > 0 || platformActive;
  const filterCount = catalogFilterCount({
    advanced: advancedFilters,
    genres: selectedGenres.length,
    status: statusFilter,
    platforms: platformIds.length,
    sortIndex,
  });

  return {
    libraryId,
    searchQuery, setSearchQuery, debouncedSearch, searching,
    selectedGenres,
    sortIndex, setSortIndex,
    statusFilter, setStatusFilter,
    sheetOpen, setSheetOpen,
    advancedFilters, filterCount, isFiltered,
    catalog, items, totalCount,
    advanced: {
      onToggleGenre: (id: string) => setSelectedGenres((g) => toggleIn(g, id)),
      onClearGenres: () => setSelectedGenres([]),
      onTogglePlatform: (id: number) => {
        setAdvancedFilters((f) => ({ ...f, platformIds: toggleIn(f.platformIds, id) }));
        setPlatformIds((prev) => toggleIn(prev, id));
      },
      onYearFromChange: (v: number | null) => setAdvancedFilters((f) => ({ ...f, yearFrom: v })),
      onYearToChange: (v: number | null) => setAdvancedFilters((f) => ({ ...f, yearTo: v })),
      onRatingMinChange: (v: number | null) => setAdvancedFilters((f) => ({ ...f, ratingMin: v })),
      onFavoriteChange: (v: boolean) => setAdvancedFilters((f) => ({ ...f, isFavorite: v })),
      // « Réinitialiser » : tout ce que la feuille règle, le tri compris.
      onReset: () => {
        setSelectedGenres([]);
        setStatusFilter(null);
        setSortIndex(0);
        setPlatformIds([]);
        setAdvancedFilters(DEFAULT_ADVANCED);
      },
    },
  };
}

export type LibraryCatalogState = ReturnType<typeof useLibraryCatalogState>;
