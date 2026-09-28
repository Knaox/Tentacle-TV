import type { ReactNode } from "react";
import { LibrarySearchField } from "../library/LibrarySearchField";
import { LibraryFilterBar } from "../LibraryFilters";
import type { WatchlistPageState } from "./useWatchlistPage";
import { StageChips, TypeSegment, ViewToggle } from "./WatchlistControls";

interface WatchlistToolbarProps {
  page: WatchlistPageState;
  /** Nom de la liste, pour l'invite du champ de recherche. */
  name: string;
  /** Partage et sélection — absents en mode sélection. */
  actions?: ReactNode;
}

/**
 * La barre de Ma liste, en trois étages qui ont chacun un rôle :
 *
 * 1. chercher, et agir sur la liste (partager, sélectionner, grille/liste) ;
 * 2. QUOI regarder — l'étape de visionnage, puis films ou séries ;
 * 3. affiner — tri, genres, années, note, plateformes : la barre de la
 *    bibliothèque, sans ses pastilles de statut que les étapes remplacent.
 *
 * `CollectionToolbar` reste celle de Mes favoris : rien n'y change.
 */
export function WatchlistToolbar({ page, name, actions }: WatchlistToolbarProps) {
  const { filters } = page;
  return (
    <div className="mb-6 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full sm:w-80 lg:w-96">
          <LibrarySearchField
            inline
            value={filters.input}
            onChange={filters.setInput}
            libraryName={name}
            busy={filters.searchPending}
            resultCount={filters.search.trim() !== "" ? filters.resultCount : null}
          />
        </div>
        <div className="ml-auto flex items-center gap-2">
          {actions}
          <ViewToggle view={page.view} onViewChange={page.setView} />
        </div>
      </div>

      <div className="scrollbar-hide -mx-4 flex items-center gap-3 overflow-x-auto px-4 py-0.5 md:-mx-8 md:px-8">
        <StageChips stage={page.stage} onStageChange={page.setStage} counts={page.stageCounts} />
        <span aria-hidden className="h-5 w-px shrink-0 bg-fill-soft" />
        <TypeSegment tabs={filters.tabs} type={filters.type} onTypeChange={filters.setType} />
      </div>

      <LibraryFilterBar
        genres={filters.genres}
        showStatus={false}
        filters={filters.filters}
        activeCount={filters.activeCount}
        hasActiveFilters={filters.hasActiveFilters}
        totalResults={filters.resultCount}
        onToggleGenre={filters.toggleGenre}
        onTogglePlatform={filters.togglePlatform}
        onStatusChange={filters.setStatusFilter}
        onYearFromChange={filters.setYearFrom}
        onYearToChange={filters.setYearTo}
        onRatingMinChange={filters.setRatingMin}
        onFavoriteChange={filters.setIsFavorite}
        onSortByChange={filters.setSortBy}
        onSortOrderChange={filters.setSortOrder}
        onReset={filters.resetFilters}
        onClearYears={filters.clearYears}
        onClearRating={filters.clearRating}
      />
    </div>
  );
}
