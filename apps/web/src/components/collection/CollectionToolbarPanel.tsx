import type { ReactNode } from "react";
import { LibraryFilterBar } from "../LibraryFilters";
import { LibrarySearchField } from "../library/LibrarySearchField";
import type { CollectionFiltersApi } from "./useCollectionFilters";

interface CollectionToolbarPanelProps {
  filters: CollectionFiltersApi;
  /** Nom de la collection, pour l'invite du champ de recherche. */
  name: string;
  /** Ce qui ouvre l'étage du bas : étapes (Ma liste), regroupement (Favoris). */
  segment?: ReactNode;
  /** Partager, sélectionner… — absents en mode sélection. */
  actions?: ReactNode;
  /** Proposer le filtre Favoris (faux sur Mes favoris, déjà tous favoris). */
  showFavorite?: boolean;
}

/**
 * La barre d'outils de Ma liste et de Mes favoris : le MÊME panneau que la
 * Bibliothèque (`LibraryFilterBar variant="panel"`), branché sur l'état des
 * collections.
 *
 * Étage haut : la recherche, le compte, le tri et son sens, puis les gestes
 * de la page. Étage bas : ce qui est propre à la page (`segment`) à la place
 * du statut de visionnage, puis les menus Genres, Année, Note, Plateformes.
 * Les trois pages se lisent ainsi comme une seule famille ; seul ce qui leur
 * appartient change de place.
 */
export function CollectionToolbarPanel({ filters, name, segment, actions, showFavorite = true }: CollectionToolbarPanelProps) {
  return (
    <LibraryFilterBar
      variant="panel"
      leading={
        <LibrarySearchField
          inline
          value={filters.input}
          onChange={filters.setInput}
          libraryName={name}
          busy={filters.searchPending}
          resultCount={filters.search.trim() !== "" ? filters.resultCount : null}
        />
      }
      segment={segment}
      actions={actions}
      showStatus={false}
      showFavorite={showFavorite}
      genres={filters.genres}
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
  );
}
