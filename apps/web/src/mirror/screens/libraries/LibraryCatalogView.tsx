import { useCallback, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { LibraryView, MediaItem } from "@tentacle-tv/shared";
import {
  CatalogFilterSheet,
  CatalogGrid,
  FilterButton,
  LibraryFilterBar,
  ScopedSearchEmpty,
  ScopedSearchField,
  useLibraryCatalogState,
} from "../../catalog";
import { LibraryHero } from "./LibraryHero";

/**
 * Le catalogue d'une bibliothèque (`components/library/LibraryCatalogView`
 * de l'app), d'un seul tenant : héros, capsule éventuelle, recherche et
 * filtres, barre rapide, pastilles, grille. Partagé par l'onglet et par
 * l'écran d'une bibliothèque ouverte d'ailleurs.
 */
export function LibraryCatalogView({ library, capsule, heroTopInset }: {
  library: LibraryView;
  /** Sous le héros : la capsule de l'onglet. */
  capsule?: ReactNode;
  /** Ce que l'ambiance remonte sous le haut de l'écran (cf. `LibraryHero`). */
  heroTopInset?: string;
}) {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const state = useLibraryCatalogState(library.Id);
  const { catalog, searching, totalCount, setSheetOpen } = state;
  const emptySearch = searching && !catalog.isLoading && totalCount === 0;

  const openItem = useCallback((item: MediaItem) => navigate(`/media/${item.Id}`), [navigate]);
  const openSheet = useCallback(() => setSheetOpen(true), [setSheetOpen]);
  const resetAll = useCallback(() => {
    state.setSearchQuery("");
    state.advanced.onReset();
  }, [state]);

  return (
    <div>
      <LibraryHero library={library} topInset={heroTopInset} />
      {capsule}
      <div className="mb-1 mt-3 flex items-center gap-2 px-4">
        <ScopedSearchField
          value={state.searchQuery}
          onChange={state.setSearchQuery}
          placeholder={t("searchInLibrary", { name: library.Name })}
          count={searching && !catalog.isLoading ? totalCount : null}
          inset={false}
        />
        <FilterButton count={state.filterCount} onPress={openSheet} />
      </div>
      {/* Le total est déjà sous le titre : le compte ne revient qu'avec un filtre. */}
      <LibraryFilterBar state={state} quick showCount={state.isFiltered} />
      {emptySearch && <ScopedSearchEmpty query={state.debouncedSearch} onApply={state.setSearchQuery} />}
      <CatalogGrid
        items={emptySearch ? [] : state.items}
        isLoading={catalog.isLoading}
        hasNextPage={catalog.hasNextPage}
        isFetchingNextPage={catalog.isFetchingNextPage}
        fetchNextPage={catalog.fetchNextPage}
        onItemPress={openItem}
        empty={emptySearch ? null : undefined}
        filtered={state.isFiltered}
        onReset={resetAll}
        captions
      />
      <CatalogFilterSheet state={state} />
    </div>
  );
}
