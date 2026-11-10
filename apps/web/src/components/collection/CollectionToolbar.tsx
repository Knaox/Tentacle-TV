import { LibrarySearchField } from "../library/LibrarySearchField";
import { LibraryFilterBar } from "../LibraryFilters";
import { chipCls } from "../library/filterChip";
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
            type="button"
            onClick={() => filters.setType(tab.key)}
            aria-pressed={filters.type === tab.key}
            // La pilule des filtres (`chipCls`) : neutre au repos, la teinte franche une fois choisie.
            className={chipCls(filters.type === tab.key)}
          >
            {tab.label}
          </button>
        ))}
        {/* Le champ vit DANS la rangée des onglets, sans les marges de page
            du mode bibliothèque (`inline`) : il s'y alignait mal, décalé vers
            le haut, son invite coupée. Sur mobile, il prend toute la ligne et
            les actions passent dessous — côte à côte, elles l'écrasaient. */}
        <div className="ml-auto flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto sm:flex-nowrap">
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
