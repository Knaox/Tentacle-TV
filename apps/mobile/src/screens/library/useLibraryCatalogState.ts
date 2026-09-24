import { useEffect, useMemo, useState } from "react";
import { useLibraries, useLibraryCatalog } from "@tentacle-tv/api-client";
import type { ExternalKind } from "@tentacle-tv/shared";
import { SORT_OPTIONS, type AdvancedFilters } from "@/components/catalog";
import { useSearchAssist } from "@/components/search/useSearchAssist";
import { usePlatformFilter } from "@/hooks/usePlatformFilter";

export type CatalogSheet = "sort" | "year" | "advanced" | null;

const DEFAULT_ADVANCED: AdvancedFilters = {
  genreIds: [], studioIds: [], platformIds: [], yearFrom: null, yearTo: null,
  ratingMin: null, isFavorite: false,
  sortBy: SORT_OPTIONS[0].sortBy, sortOrder: SORT_OPTIONS[0].sortOrder,
};

/**
 * Tout l'état d'un catalogue de bibliothèque — recherche, genres, tri,
 * année, statut, filtres avancés, plateformes —, la requête qui en découle
 * et l'assistance de la barre. Partagé par l'écran empilé
 * (`/library/[id]`) et l'onglet Bibliothèque : les deux filtrent, trient et
 * suggèrent au geste près.
 */
export function useLibraryCatalogState(libraryId: string) {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedPlatformIds, setSelectedPlatformIds] = useState<number[]>([]);
  const [sortIndex, setSortIndex] = useState(0);
  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [sheet, setSheet] = useState<CatalogSheet>(null);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>(DEFAULT_ADVANCED);

  const advancedActiveCount = useMemo(() => {
    let c = 0;
    if (advancedFilters.studioIds.length > 0) c++;
    if (advancedFilters.yearFrom != null || advancedFilters.yearTo != null) c++;
    if (advancedFilters.ratingMin != null) c++;
    if (advancedFilters.isFavorite) c++;
    return c;
  }, [advancedFilters]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const yearsParam = useMemo(() => {
    if (advancedFilters.yearFrom != null || advancedFilters.yearTo != null) {
      const from = advancedFilters.yearFrom ?? 1900;
      const to = advancedFilters.yearTo ?? new Date().getFullYear();
      const arr: string[] = [];
      for (let y = from; y <= to; y++) arr.push(String(y));
      return arr;
    }
    return selectedYear ? [selectedYear] : undefined;
  }, [advancedFilters.yearFrom, advancedFilters.yearTo, selectedYear]);

  const catalog = useLibraryCatalog(libraryId, {
    sortBy: SORT_OPTIONS[sortIndex].sortBy,
    sortOrder: SORT_OPTIONS[sortIndex].sortOrder,
    genreIds: selectedGenres.length > 0 ? selectedGenres : undefined,
    years: yearsParam,
    statusFilter: statusFilter ?? undefined,
    searchTerm: debouncedSearch.length >= 2 ? debouncedSearch : undefined,
    studioIds: advancedFilters.studioIds.length > 0 ? advancedFilters.studioIds : undefined,
    minCommunityRating: advancedFilters.ratingMin ?? undefined,
    isFavorite: advancedFilters.isFavorite || undefined,
    limit: selectedPlatformIds.length > 0 ? 500 : undefined,
  });

  const allCatalogItems = useMemo(() => catalog.data?.pages.flatMap((p) => p.Items) ?? [], [catalog.data]);
  const { filteredItems: platformFiltered } = usePlatformFilter(allCatalogItems, selectedPlatformIds);
  const platformActive = selectedPlatformIds.length > 0;
  const totalCount = platformActive ? platformFiltered.length : (catalog.data?.pages[0]?.TotalRecordCount ?? 0);
  const searching = debouncedSearch.length >= 2;

  // Une bibliothèque de films ne suggère que des films (le moteur est global).
  const collectionType = useLibraries().data?.find((lib) => lib.Id === libraryId)?.CollectionType;
  const kind: ExternalKind | null = collectionType === "movies" ? "movie" : collectionType === "tvshows" ? "series" : null;
  const assist = useSearchAssist(searchQuery, setSearchQuery, { kind });

  const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  return {
    libraryId,
    searchQuery, setSearchQuery, debouncedSearch, searching, assist,
    selectedGenres, setSelectedGenres,
    sortIndex, setSortIndex,
    selectedYear, setSelectedYear,
    statusFilter, setStatusFilter,
    sheet, setSheet,
    advancedFilters, advancedActiveCount,
    catalog,
    platformActive, platformFiltered, totalCount,
    advanced: {
      onToggleGenre: (id: string) => setAdvancedFilters((f) => ({ ...f, genreIds: toggle(f.genreIds, id) })),
      onToggleStudio: (id: string) => setAdvancedFilters((f) => ({ ...f, studioIds: toggle(f.studioIds, id) })),
      onTogglePlatform: (id: number) => {
        setAdvancedFilters((f) => ({ ...f, platformIds: toggle(f.platformIds, id) }));
        setSelectedPlatformIds((prev) => toggle(prev, id));
      },
      onYearFromChange: (v: number | null) => setAdvancedFilters((f) => ({ ...f, yearFrom: v })),
      onYearToChange: (v: number | null) => setAdvancedFilters((f) => ({ ...f, yearTo: v })),
      onRatingMinChange: (v: number | null) => setAdvancedFilters((f) => ({ ...f, ratingMin: v })),
      onFavoriteChange: (v: boolean) => setAdvancedFilters((f) => ({ ...f, isFavorite: v })),
      onSortByChange: (sortBy: string, sortOrder: string) => setAdvancedFilters((f) => ({ ...f, sortBy, sortOrder })),
      onReset: () => {
        setSelectedPlatformIds([]);
        setAdvancedFilters(DEFAULT_ADVANCED);
      },
    },
  };
}

export type LibraryCatalogState = ReturnType<typeof useLibraryCatalogState>;
