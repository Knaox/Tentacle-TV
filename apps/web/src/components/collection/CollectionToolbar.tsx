import { LibrarySearchField } from "../library/LibrarySearchField";
import { LibraryFilterBar } from "../LibraryFilters";
import type { CollectionFiltersApi } from "./useCollectionFilters";

interface CollectionToolbarProps {
  filters: CollectionFiltersApi;
  /** Nom de la collection — il complète le libellé du champ de recherche. */
  name: string;
  /** Faux sur la page Favoris : y filtrer les favoris ne trierait rien. */
  showFavorite?: boolean;
  /** Boutons propres à la page (partage, sélection), poussés à droite. */
  actions?: React.ReactNode;
}

/**
 * La barre de Ma liste et de Mes favoris : recherche, onglets de type, et la
 * barre de filtres de la BIBLIOTHÈQUE, sans copie ni variante.
 *
 * Tout ce qui est rendu ici existait déjà. Ce qui manquait, c'était de pouvoir
 * poser `LibraryFilterBar` sans identifiant de bibliothèque — d'où sa prop
 * `genres`, que le hook dérive des titres chargés.
 */
export function CollectionToolbar({ filters, name, showFavorite, actions }: CollectionToolbarProps) {
  return (
    <div className="mb-6 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {filters.tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => filters.setType(tab.key)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
              filters.type === tab.key
                ? "bg-[rgba(var(--brand-rgb),0.2)] text-[var(--brand-light)] ring-1 ring-[rgba(var(--brand-rgb),0.3)]"
                : "bg-fill-subtle text-content-tertiary hover:bg-fill-soft hover:text-content-secondary"
            }`}
          >
            {tab.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          {/* Le libellé se compose depuis la clé existante, qui interpole déjà
              un nom : « Rechercher dans Ma liste… ». Aucune clé nouvelle. */}
          <LibrarySearchField
            value={filters.input}
            onChange={filters.setInput}
            libraryName={name}
          />
          {actions}
        </div>
      </div>

      <LibraryFilterBar
        genres={filters.genres}
        showFavorite={showFavorite}
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
