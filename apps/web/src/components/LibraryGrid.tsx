import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { useLibraryCatalog } from "@tentacle-tv/api-client";
import { useItemsPerRow } from "../hooks/useItemsPerRow";
import { LibraryFilterBar } from "./LibraryFilters";
import { useLibraryFilters } from "../hooks/useLibraryFilters";
import { LibrarySearchField } from "./library/LibrarySearchField";
import { LibraryGridCard } from "./LibraryGridCard";
import { LibraryGridEmpty } from "./library/LibraryGridEmpty";
import { usePlatformFilter } from "../hooks/usePlatformFilter";

interface LibraryGridProps {
  libraryId: string;
  libraryName: string;
}

const POSTER_ASPECT = 2 / 3;
/**
 * Hauteur du bloc de légende, en pixels — une PREMIÈRE approximation, plus une
 * vérité.
 *
 * Elle a longtemps été la seule chose que le virtualiseur connaissait de la
 * hauteur d'une rangée, et elle est calée sur la typographie du navigateur.
 * Toute typographie plus grande la dément : un plancher de taille de police —
 * ce que pose la cible téléviseur, où l'on lit à trois mètres —, un zoom, une
 * préférence système, ou simplement un titre qui passe sur deux lignes dans une
 * autre langue.
 *
 * Mesuré sur la dalle avant correctif : légende de 80 px contre 52 annoncés,
 * donc un pas de rangée de 342 px pour des cartes de 353. Les rangées étant
 * positionnées en absolu, elles ne se contentaient pas de se serrer : elles se
 * RECOUVRAIENT de onze pixels, les affiches d'une ligne mordant sur le titre de
 * la précédente. C'est le « manque d'espacement » signalé.
 *
 * Le virtualiseur mesure désormais les rangées qu'il a montées
 * (`measureElement`), et cette constante ne sert plus qu'à réserver la place
 * avant la première mesure.
 */
const TEXT_HEIGHT = 52;
const GAP = 16;

export function LibraryGrid({ libraryId, libraryName }: LibraryGridProps) {
  const { t } = useTranslation("common");
  const {
    filters, search, setSearch, queryKey,
    toggleGenre, togglePlatform, setYearFrom, setYearTo,
    setRatingMin, setStatusFilter, setIsFavorite, setSortBy, setSortOrder,
    resetFilters, clearYears, clearRating, activeCount, hasActiveFilters,
  } = useLibraryFilters();

  // La frappe reste locale — l'adresse ne prend que la valeur stabilisée, sans
  // quoi chaque lettre écrirait dans l'historique. Le champ part de ce que
  // porte l'adresse : revenir d'une fiche retrouve la recherche en cours.
  const [input, setInput] = useState(search);

  useEffect(() => {
    const timer = setTimeout(() => {
      const value = input.trim();
      if (value !== search) setSearch(value);
    }, 300);
    return () => clearTimeout(timer);
  }, [input, search, setSearch]);

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
    searchTerm: search,
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
  }, [queryKey, isLoading]);

  const virtualizer = useWindowVirtualizer({
    count: rowCount,
    estimateSize,
    // Cinq rangées de rab de chaque côté, c'était dix rangées de cartes montées
    // en permanence — et, en défilement rapide, autant de rangées traversées
    // qui réclamaient leurs affiches sans jamais avoir été regardées. Trois
    // suffit à ne jamais laisser de trou (`CardImage` prend 400 px d'avance de
    // son côté pour charger).
    overscan: 3,
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

  // Poser un filtre relance la grille depuis le début — mais un simple
  // REMONTAGE ne doit rien bousculer : revenir d'une fiche doit rendre la page
  // telle qu'on l'a laissée, ce dont `useScrollMemory` se charge. D'où la
  // comparaison des états successifs plutôt qu'un effet au montage.
  const dernierEtat = useRef(queryKey);
  useEffect(() => {
    if (dernierEtat.current === queryKey) return;
    dernierEtat.current = queryKey;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [queryKey]);

  const navigate = useNavigate();
  const handleNavigate = useCallback(
    (id: string) => navigate(`/media/${id}`),
    [navigate],
  );

  return (
    <div>
      <LibrarySearchField value={input} onChange={setInput} libraryName={libraryName} />

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
              <div key={i} className="skeleton-shimmer aspect-[2/3] rounded-[var(--radius-lg)]" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <LibraryGridEmpty
            filtered={search.length >= 2 || hasActiveFilters}
            onReset={() => { setInput(""); resetFilters(); }}
          />
        ) : (
          <div>
            {/* `row-dim` : survoler la grille éteint les affiches voisines,
                comme sur les rangées de l'accueil. */}
            <div
              className="row-dim"
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
                    // Mesurée, pas estimée. `data-index` est ce par quoi le
                    // virtualiseur reconnaît la rangée qu'on lui rend ; sans
                    // hauteur imposée, il lit celle du contenu et corrige son
                    // estimation. Poser `height: virtualRow.size` ici, comme
                    // c'était fait, revenait à lui faire mesurer sa propre
                    // supposition.
                    ref={virtualizer.measureElement}
                    data-index={virtualRow.index}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      // La gouttière appartient à la rangée, en PADDING et non
                      // en marge : c'est la boîte que le virtualiseur mesure, et
                      // une marge n'y entre pas. Elle était comptée dans
                      // l'estimation ; mesurer sans elle collait les rangées les
                      // unes aux autres.
                      paddingBottom: GAP,
                      transform: `translateY(${virtualRow.start - virtualizer.options.scrollMargin}px)`,
                    }}
                  >
                    {isLoaderRow ? (
                      /* Hauteur explicite : la rangée n'en impose plus, donc
                         `h-full` s'y résoudrait à zéro. */
                      <div className="flex h-40 items-center justify-center">
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--brand)] border-t-transparent" />
                        <span className="ml-2 text-sm text-content-quaternary">{t("common:loadingMore")}</span>
                      </div>
                    ) : (
                      <div
                        className="grid"
                        /* La cible téléviseur substitue `useItemsPerRow`
                           (`ui/grille/colonnesTv.ts`) : il publie la largeur de
                           carte et sonde le moteur pour savoir s'il applique
                           `gap` lui-même, et `grille-tv.css` pose l'écart en
                           marges ou rien. Mesuré sur la dalle : 16 px dans les
                           deux sens, sur les deux chemins.
                           tv-compat-ok: traité par colonnesTv.ts + grille-tv.css */
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
                <span className="ml-2 text-sm text-content-quaternary">{t("common:loadingMore")}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

