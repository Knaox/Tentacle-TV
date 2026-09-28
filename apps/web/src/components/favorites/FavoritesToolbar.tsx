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
 * La barre de Mes favoris : recherche, regroupement et actions (sur une ou deux
 * lignes selon la largeur),
 * puis la barre de filtres de la BIBLIOTHÈQUE telle quelle (genres,
 * plateformes, années, note, tri). Les onglets Tous/Films/Séries de
 * `CollectionToolbar` n'y sont plus : les tuiles du bilan les portent, avec
 * leurs comptes.
 */
export function FavoritesToolbar({ filters, name, groupMode, onGroupModeChange, actions }: FavoritesToolbarProps) {
  return (
    <div className="flex flex-col gap-3">
      {/* Recherche et actions sur la première ligne, « Regrouper » sur la
          sienne ; les trois tiennent sur une seule à partir de 1280 px. Sous
          ce palier, la fenêtre minimale d'Electron (900 px) les faisait
          déborder de quelques pixels, et les actions partaient seules à la
          ligne. */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-3">
        <div className="min-w-[16rem] flex-1 xl:max-w-md">
          <LibrarySearchField
            inline
            value={filters.input}
            onChange={filters.setInput}
            libraryName={name}
            busy={filters.searchPending}
            resultCount={filters.search.trim() !== "" ? filters.resultCount : null}
          />
        </div>
        <div className="order-last flex basis-full xl:order-none xl:ml-auto xl:basis-auto">
          <FavoritesGroupPicker mode={groupMode} onChange={onGroupModeChange} />
        </div>
        {actions}
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
