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

/**
 * Style commun à tous les chips de la barre de filtre (status, favoris,
 * filtres avancés, genres). Pill rounded-full glass — état actif violet
 * brand semi-transparent + ring, aligné sur PremiumChip et QualityBadge.
 * Variante "rose" pour le filtre Favoris (sémantique cœur rouge).
 */
function chipCls(active: boolean, accent: "violet" | "rose" = "violet"): string {
  const base =
    "rounded-full px-3 py-1.5 text-xs font-medium transition-colors backdrop-blur-md";
  if (!active) {
    return `${base} bg-white/5 text-white/70 ring-1 ring-white/10 hover:bg-white/10 hover:text-white`;
  }
  if (accent === "rose") {
    return `${base} bg-[rgba(var(--brand-accent-rgb),0.18)] text-[var(--brand-accent-light)] ring-1 ring-[rgba(var(--brand-accent-rgb),0.45)]`;
  }
  return `${base} bg-[rgba(var(--brand-rgb),0.2)] text-[var(--brand-light)] ring-1 ring-[rgba(var(--brand-rgb),0.5)]`;
}

function HeartIcon({ filled }: { filled: boolean }) {
  return filled ? (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 21s-7.5-4.5-9.5-9.2C1 8.2 3.2 5 6.5 5c2 0 3.6 1.1 4.5 2.4 1-1.3 2.5-2.4 4.5-2.4 3.3 0 5.5 3.2 4 6.8C19.5 16.5 12 21 12 21z" />
    </svg>
  ) : (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
    </svg>
  );
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
      {/* Quick filters — même langage visuel que les genres : pill (rounded-full)
          + état actif glass violet (jamais de fond plein qui crashe avec le
          reste du design system Tentacle). */}
      <div className="flex flex-wrap items-center gap-2">
        {STATUS_QUICK.map((opt) => (
          <button
            key={opt.key}
            onClick={() => { props.onStatusChange(opt.value); props.onFavoriteChange(false); }}
            className={chipCls(
              props.filters.statusFilter === opt.value && !props.filters.isFavorite,
            )}
          >
            {t(`common:${opt.key}`)}
          </button>
        ))}
        <button
          onClick={() => { props.onFavoriteChange(!props.filters.isFavorite); if (!props.filters.isFavorite) props.onStatusChange(null); }}
          className={`${chipCls(props.filters.isFavorite, "rose")} inline-flex items-center gap-1.5`}
        >
          <HeartIcon filled={props.filters.isFavorite} />
          {t("common:favorites")}
        </button>

        <div className="mx-1 h-5 w-px bg-white/10" />

        {/* Bouton "Filtres avancés" — même pill que le reste, juste avec icône. */}
        <button
          onClick={() => setPanelOpen(true)}
          className={`${chipCls(props.activeCount > 0)} inline-flex items-center gap-1.5`}
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
          </svg>
          {t("common:advancedFilters")}
          {props.activeCount > 0 && (
            <span className="ml-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[rgba(var(--brand-rgb),0.4)] px-1 text-[10px] font-bold text-[var(--brand-light)] ring-1 ring-[rgba(var(--brand-rgb),0.5)]">
              {props.activeCount}
            </span>
          )}
        </button>
      </div>

      {/* Genre chips — exactement le même chipCls que les quick filters. */}
      {genres && genres.length > 0 && (
        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          <button
            onClick={() => props.filters.genreIds.forEach(props.onToggleGenre)}
            className={`${chipCls(props.filters.genreIds.length === 0)} flex-shrink-0`}
          >
            {t("common:allGenres")}
          </button>
          {genres.map((g) => (
            <button
              key={g.Id}
              onClick={() => props.onToggleGenre(g.Id)}
              className={`${chipCls(props.filters.genreIds.includes(g.Id))} flex-shrink-0 whitespace-nowrap`}
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
