import type { ReactNode } from "react";
import type { FavoritesGroupMode } from "@tentacle-tv/api-client";
import { LibrarySearchField } from "../library/LibrarySearchField";
import { LibraryFilterBar } from "../LibraryFilters";
import type { CollectionFiltersApi } from "../collection/useCollectionFilters";
import { FavoritesGroupPicker } from "./FavoritesGroupPicker";

interface FavoritesToolbarProps {
  filters: CollectionFiltersApi;
  name: string;
  groupMode: FavoritesGroupMode;
  onGroupModeChange: (mode: FavoritesGroupMode) => void;
  /** Partage et sélection, poussés à droite. */
  actions?: ReactNode;
}

/**
 * La barre de Mes favoris : recherche, regroupement et actions sur une ligne,
 * puis la barre de filtres de la BIBLIOTHÈQUE telle quelle (genres,
 * plateformes, années, note, tri). Les onglets Tous/Films/Séries de
 * `CollectionToolbar` n'y sont plus : les tuiles du bilan les portent, avec
 * leurs comptes. Sur mobile, chaque bloc prend sa ligne.
 */
export function FavoritesToolbar({ filters, name, groupMode, onGroupModeChange, actions }: FavoritesToolbarProps) {
  return (
    <div className="mb-6 flex flex-col gap-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="w-full lg:w-96">
          <LibrarySearchField
            inline
            value={filters.input}
            onChange={filters.setInput}
            libraryName={name}
            busy={filters.searchPending}
            resultCount={filters.search.trim() !== "" ? filters.resultCount : null}
          />
        </div>
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 lg:ml-auto lg:flex-nowrap lg:justify-end">
          <FavoritesGroupPicker mode={groupMode} onChange={onGroupModeChange} />
          {actions}
        </div>
      </div>

      <LibraryFilterBar
        genres={filters.genres}
        showFavorite={false}
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
