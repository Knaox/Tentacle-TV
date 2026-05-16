import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { useLibraryCatalog } from "@tentacle-tv/api-client";
import { useItemsPerRow } from "../hooks/useItemsPerRow";
import { LibraryFilterBar, useLibraryFilters } from "./LibraryFilters";
import { LibraryGridCard } from "./LibraryGridCard";
import { usePlatformFilter } from "../hooks/usePlatformFilter";

interface LibraryGridProps {
  libraryId: string;
  libraryName: string;
}

const POSTER_ASPECT = 2 / 3;
const TEXT_HEIGHT = 52;
const GAP = 16;

export function LibraryGrid({ libraryId, libraryName }: LibraryGridProps) {
  const { t } = useTranslation("common");
  const [input, setInput] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(input.trim()), 300);
    return () => clearTimeout(timer);
  }, [input]);

  const {
    filters, toggleGenre, togglePlatform, setYearFrom, setYearTo,
    setRatingMin, setStatusFilter, setIsFavorite, setSortBy, setSortOrder,
    resetFilters, clearYears, clearRating, activeCount, hasActiveFilters,
  } = useLibraryFilters();

  // Construire les années pour le hook
  const yearsParam = useMemo(() => {
    if (!filters.yearFrom && !filters.yearTo) return undefined;
    const from = filters.yearFrom ?? 1900;
    const to = filters.yearTo ?? new Date().getFullYear();
    const arr: string[] = [];
    for (let y = from; y <= to; y++) arr.push(String(y));
    return arr;
  }, [filters.yearFrom, filters.yearTo]);

  const {
    data,
    isLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useLibraryCatalog(libraryId, {
    searchTerm: debounced,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
    genreIds: filters.genreIds.length > 0 ? filters.genreIds : undefined,
    studioIds: filters.studioIds.length > 0 ? filters.studioIds : undefined,
    years: yearsParam,
    statusFilter: filters.statusFilter ?? undefined,
    minCommunityRating: filters.ratingMin ?? undefined,
    isFavorite: filters.isFavorite || undefined,
    limit: filters.platformIds.length > 0 ? 500 : 50,
  });

  const allItems = useMemo(
    () => data?.pages.flatMap((p) => p.Items) ?? [],
    [data],
  );

  // Filtre plateforme TMDB (côté client, via /api/tmdb/check-providers)
  const { filteredItems: platformFiltered } = usePlatformFilter(allItems, filters.platformIds);
  const items = filters.platformIds.length > 0 ? platformFiltered : allItems;
  const totalCount = filters.platformIds.length > 0 ? items.length : (data?.pages[0]?.TotalRecordCount ?? 0);

  const gridRef = useRef<HTMLDivElement>(null);
  const { itemsPerRow, containerWidth } = useItemsPerRow(gridRef);

  const rowCount = useMemo(
    () => Math.ceil(items.length / itemsPerRow) + (hasNextPage ? 1 : 0),
    [items.length, itemsPerRow, hasNextPage],
  );

  const estimateSize = useCallback(() => {
    if (containerWidth <= 0) return 320;
    const cardWidth = (containerWidth - GAP * (itemsPerRow - 1)) / itemsPerRow;
    return cardWidth / POSTER_ASPECT + TEXT_HEIGHT + GAP;
  }, [containerWidth, itemsPerRow]);

  // scrollMargin dynamique — recalculé quand les filtres changent la hauteur du header
  const [scrollMargin, setScrollMargin] = useState(0);
  useEffect(() => {
    if (gridRef.current) setScrollMargin(gridRef.current.offsetTop);
  }, [filters, debounced, isLoading]);

  const virtualizer = useWindowVirtualizer({
    count: rowCount,
    estimateSize,
    overscan: 5,
    scrollMargin,
  });

  // Fetch next page when approaching the end
  useEffect(() => {
    const virtualItems = virtualizer.getVirtualItems();
    const lastItem = virtualItems.at(-1);
    if (!lastItem) return;
    if (lastItem.index >= rowCount - 3 && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [virtualizer.getVirtualItems(), hasNextPage, isFetchingNextPage, fetchNextPage, rowCount]);

  // Reset scroll when filters change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [filters, debounced]);

  const navigate = useNavigate();
  const handleNavigate = useCallback(
    (id: string) => navigate(`/media/${id}`),
    [navigate],
  );

  return (
    <div>
      {/* Search bar */}
      <div className="mb-4 px-4 md:px-8">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("common:searchInLibrary", { name: libraryName })}
          className="w-full max-w-md rounded-xl bg-white/5 px-5 py-3 text-white placeholder-white/30 outline-none ring-1 ring-white/10 transition-all focus:ring-[rgba(var(--brand-rgb),0.5)]"
        />
      </div>

      {/* Filtres rapides + avancés */}
      <div className="mb-6 px-4 md:px-8">
        <LibraryFilterBar
          libraryId={libraryId}
          filters={filters}
          activeCount={activeCount}
          hasActiveFilters={hasActiveFilters}
          totalResults={totalCount > 0 ? totalCount : undefined}
          onToggleGenre={toggleGenre}
          onTogglePlatform={togglePlatform}
          onStatusChange={setStatusFilter}
          onYearFromChange={setYearFrom}
          onYearToChange={setYearTo}
          onRatingMinChange={setRatingMin}
          onFavoriteChange={setIsFavorite}
          onSortByChange={setSortBy}
          onSortOrderChange={setSortOrder}
          onReset={resetFilters}
          onClearYears={clearYears}
          onClearRating={clearRating}
        />
      </div>

      {/* Grid */}
      <div className="px-4 md:px-8" ref={gridRef}>
        {isLoading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8">
            {Array.from({ length: 24 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] animate-pulse rounded-xl bg-white/5" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="py-20 text-center text-white/40">
            {debounced.length >= 2 ? t("common:noResults") : t("common:emptyLibrary")}
          </p>
        ) : (
          <div>
            <div
              style={{
                height: virtualizer.getTotalSize(),
                width: "100%",
                position: "relative",
              }}
            >
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const startIdx = virtualRow.index * itemsPerRow;
                const rowItems = items.slice(startIdx, startIdx + itemsPerRow);
                const isLoaderRow = virtualRow.index >= Math.ceil(items.length / itemsPerRow);

                return (
                  <div
                    key={virtualRow.key}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: virtualRow.size,
                      transform: `translateY(${virtualRow.start - virtualizer.options.scrollMargin}px)`,
                    }}
                  >
                    {isLoaderRow ? (
                      <div className="flex h-full items-center justify-center">
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--brand)] border-t-transparent" />
                        <span className="ml-2 text-sm text-white/40">{t("common:loadingMore")}</span>
                      </div>
                    ) : (
                      <div
                        className="grid"
                        style={{
                          gridTemplateColumns: `repeat(${itemsPerRow}, 1fr)`,
                          gap: GAP,
                        }}
                      >
                        {rowItems.map((item) => (
                          <LibraryGridCard
                            key={item.Id}
                            item={item}
                            onNavigate={handleNavigate}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {isFetchingNextPage && (
              <div className="flex items-center justify-center py-4">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--brand)] border-t-transparent" />
                <span className="ml-2 text-sm text-white/40">{t("common:loadingMore")}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

