import { useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useGenres } from "@tentacle-tv/api-client";
import { LibraryFilterPanel } from "./LibraryFilterPanel";
import { LibraryActiveFilterPills } from "./LibraryActiveFilterPills";

export interface LibraryFilterState {
  genreIds: string[];
  studioIds: string[];
  platformIds: number[];
  yearFrom: number | null;
  yearTo: number | null;
  ratingMin: number | null;
  statusFilter: string | null;
  isFavorite: boolean;
  sortBy: string;
  sortOrder: string;
}

const DEFAULT: LibraryFilterState = {
  genreIds: [],
  studioIds: [],
  platformIds: [],
  yearFrom: null,
  yearTo: null,
  ratingMin: null,
  statusFilter: null,
  isFavorite: false,
  sortBy: "SortName",
  sortOrder: "Ascending",
};

export function useLibraryFilters() {
  const [filters, setFilters] = useState<LibraryFilterState>(DEFAULT);

  const toggleGenre = useCallback((id: string) => {
    setFilters((f) => ({
      ...f,
      genreIds: f.genreIds.includes(id) ? f.genreIds.filter((g) => g !== id) : [...f.genreIds, id],
    }));
  }, []);

  const toggleStudio = useCallback((id: string) => {
    setFilters((f) => ({
      ...f,
      studioIds: f.studioIds.includes(id) ? f.studioIds.filter((s) => s !== id) : [...f.studioIds, id],
    }));
  }, []);

  const togglePlatform = useCallback((id: number) => {
    setFilters((f) => ({
      ...f,
      platformIds: f.platformIds.includes(id) ? f.platformIds.filter((p) => p !== id) : [...f.platformIds, id],
    }));
  }, []);
  const setYearFrom = useCallback((v: number | null) => setFilters((f) => ({ ...f, yearFrom: v })), []);
  const setYearTo = useCallback((v: number | null) => setFilters((f) => ({ ...f, yearTo: v })), []);
  const setRatingMin = useCallback((v: number | null) => setFilters((f) => ({ ...f, ratingMin: v })), []);
  const setStatusFilter = useCallback((v: string | null) => setFilters((f) => ({ ...f, statusFilter: v })), []);
  const setIsFavorite = useCallback((v: boolean) => setFilters((f) => ({ ...f, isFavorite: v })), []);
  const setSortBy = useCallback((v: string) => setFilters((f) => ({ ...f, sortBy: v })), []);
  const setSortOrder = useCallback((v: string) => setFilters((f) => ({ ...f, sortOrder: v })), []);
  const resetFilters = useCallback(() => setFilters(DEFAULT), []);
  const clearYears = useCallback(() => setFilters((f) => ({ ...f, yearFrom: null, yearTo: null })), []);
  const clearRating = useCallback(() => setFilters((f) => ({ ...f, ratingMin: null })), []);

  const activeCount = useMemo(() => {
    let c = 0;
    if (filters.genreIds.length > 0) c++;
    if (filters.studioIds.length > 0) c++;
    if (filters.platformIds.length > 0) c++;
    if (filters.yearFrom != null || filters.yearTo != null) c++;
    if (filters.ratingMin != null) c++;
    if (filters.statusFilter) c++;
    if (filters.isFavorite) c++;
    return c;
  }, [filters]);

  return {
    filters, toggleGenre, toggleStudio, togglePlatform, setYearFrom, setYearTo,
    setRatingMin, setStatusFilter, setIsFavorite, setSortBy, setSortOrder,
    resetFilters, clearYears, clearRating, activeCount, hasActiveFilters: activeCount > 0,
  };
}

/* ── Quick filter bar + advanced panel trigger ────── */

const STATUS_QUICK = [
  { value: null, key: "allFilter" },
  { value: "IsUnplayed", key: "unwatched" },
  { value: "IsResumable", key: "inProgress" },
] as const;

interface LibraryFilterBarProps {
  libraryId: string;
  filters: LibraryFilterState;
  activeCount: number;
  hasActiveFilters: boolean;
  totalResults: number | undefined;
  onToggleGenre: (id: string) => void;
  onTogglePlatform: (id: number) => void;
  onStatusChange: (v: string | null) => void;
  onYearFromChange: (v: number | null) => void;
  onYearToChange: (v: number | null) => void;
  onRatingMinChange: (v: number | null) => void;
  onFavoriteChange: (v: boolean) => void;
  onSortByChange: (v: string) => void;
  onSortOrderChange: (v: string) => void;
  onReset: () => void;
  onClearYears: () => void;
  onClearRating: () => void;
}

export function LibraryFilterBar(props: LibraryFilterBarProps) {
  const { t } = useTranslation("common");
  const { data: genres } = useGenres(props.libraryId);
  const [panelOpen, setPanelOpen] = useState(false);

  return (
    <>
      {/* Quick filters: status + favorites + advanced button */}
      <div className="flex flex-wrap items-center gap-2">
        {STATUS_QUICK.map((opt) => (
          <button
            key={opt.key}
            onClick={() => { props.onStatusChange(opt.value); props.onFavoriteChange(false); }}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              props.filters.statusFilter === opt.value && !props.filters.isFavorite
                ? "bg-[#8b5cf6] text-white shadow-lg shadow-purple-500/20"
                : "bg-white/5 text-white/50 hover:bg-white/10"
            }`}
          >
            {t(`common:${opt.key}`)}
          </button>
        ))}
        <button
          onClick={() => { props.onFavoriteChange(!props.filters.isFavorite); if (!props.filters.isFavorite) props.onStatusChange(null); }}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
            props.filters.isFavorite
              ? "bg-red-500/20 text-red-400 shadow-lg shadow-red-500/10"
              : "bg-white/5 text-white/50 hover:bg-white/10"
          }`}
        >
          ♥ {t("common:favorites")}
        </button>

        <div className="mx-1 h-5 w-px bg-white/10" />

        {/* Advanced filter button — exact Seer style */}
        <button
          onClick={() => setPanelOpen(true)}
          className="relative flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/60 transition-colors hover:bg-white/10 hover:text-white/80"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
          </svg>
          {t("common:advancedFilters")}
          {props.activeCount > 0 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#8b5cf6] text-[10px] font-bold text-white">
              {props.activeCount}
            </span>
          )}
        </button>
      </div>

      {/* Genre chips — always visible */}
      {genres && genres.length > 0 && (
        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          <button
            onClick={() => props.filters.genreIds.forEach(props.onToggleGenre)}
            className={`flex-shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-all ${
              props.filters.genreIds.length === 0
                ? "bg-[#8b5cf6] text-white"
                : "bg-white/5 text-white/50 hover:bg-white/10"
            }`}
          >
            {t("common:allGenres")}
          </button>
          {genres.map((g) => (
            <button
              key={g.Id}
              onClick={() => props.onToggleGenre(g.Id)}
              className={`flex-shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-all ${
                props.filters.genreIds.includes(g.Id)
                  ? "bg-[#8b5cf6]/20 text-[#8b5cf6] ring-1 ring-[#8b5cf6]/50"
                  : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70"
              }`}
            >
              {g.Name}
            </button>
          ))}
        </div>
      )}

      {/* Active filter pills — exact Seer style */}
      <LibraryActiveFilterPills
        libraryId={props.libraryId}
        filters={props.filters}
        hasActiveFilters={props.hasActiveFilters}
        totalResults={props.totalResults}
        onRemoveGenre={props.onToggleGenre}
        onClearPlatform={(id) => props.onTogglePlatform(id)}
        onClearYears={props.onClearYears}
        onClearRating={props.onClearRating}
        onReset={props.onReset}
      />

      {/* Advanced filter panel — exact Seer slide-over */}
      <LibraryFilterPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        libraryId={props.libraryId}
        filters={props.filters}
        onToggleGenre={props.onToggleGenre}
        onTogglePlatform={props.onTogglePlatform}
        onYearFromChange={props.onYearFromChange}
        onYearToChange={props.onYearToChange}
        onRatingMinChange={props.onRatingMinChange}
        onSortByChange={props.onSortByChange}
        onSortOrderChange={props.onSortOrderChange}
        onReset={props.onReset}
        activeFilterCount={props.activeCount}
      />
    </>
  );
}
