import { useCallback, useEffect, useRef, type ReactNode, type RefObject } from "react";
import { View, useWindowDimensions, type FlatList } from "react-native";
import { useRouter } from "expo-router";
import type { LibraryView, MediaItem } from "@tentacle-tv/shared";
import { CatalogGrid } from "@/components/catalog";
import { LibraryHero } from "@/components/library/LibraryHero";
import { LibrarySearchRow } from "@/components/library/LibrarySearchRow";
import { ScopedSearchEmpty } from "@/components/search/ScopedSearchEmpty";
import { SearchAssistPane } from "@/components/search/SearchAssistPane";
import type { useScrollChromeHandler } from "@/components/navigation/scrollChrome";
import { spacing } from "@/theme";
import { LibraryFilterBar, LibrarySheets } from "@/screens/library/LibraryFilterBar";
import { useLibraryCatalogState } from "@/screens/library/useLibraryCatalogState";

const NONE: MediaItem[] = [];

interface Props {
  library: LibraryView;
  /** Sous le héros : la capsule de l'onglet, qui passe d'une bibliothèque à l'autre. */
  capsule?: ReactNode;
  /** Ce que l'en-tête (flottant ou système) recouvre en haut. */
  topInset: number;
  /** Ce que la barre d'onglets flottante couvre en bas. */
  bottomInset?: number;
  onScroll?: ReturnType<typeof useScrollChromeHandler>;
  listRef?: RefObject<FlatList<MediaItem> | null>;
  /**
   * Ce qui flotte encore sous l'en-tête (le retour de l'écran empilé) : la
   * rangée de recherche s'amarre dessous à la frappe, pas derrière.
   */
  searchDockOffset?: number;
}

/**
 * Le catalogue d'une bibliothèque, d'un seul tenant — héros, capsule
 * éventuelle, recherche et bouton de filtres, barre rapide (statut, favoris,
 * tri), pastilles des autres filtres, puis la grille infinie. Tout défile
 * ensemble.
 *
 * L'onglet Bibliothèque et l'écran d'une bibliothèque ouverte d'ailleurs le
 * partagent : le second avait sa propre mise en page, plus pauvre (pas
 * d'ambiance, recherche repliée), pour un état et des filtres identiques.
 */
export function LibraryCatalogView({
  library, capsule, topInset, bottomInset = 0, onScroll, listRef, searchDockOffset = 0,
}: Props) {
  const router = useRouter();
  const { height: windowH } = useWindowDimensions();
  const ownRef = useRef<FlatList<MediaItem>>(null);
  const ref = listRef ?? ownRef;
  const state = useLibraryCatalogState(library.Id);
  const { assist, catalog, searching, totalCount } = state;
  const emptySearch = searching && !catalog.isLoading && totalCount === 0;

  const openItem = useCallback((item: MediaItem) => router.push(`/media/${item.Id}`), [router]);
  const resetAll = useCallback(() => {
    state.setSearchQuery("");
    state.advanced.onReset();
  }, [state]);

  // Le champ monte sous l'en-tête quand on y tape, comme une barre de
  // recherche iOS : le héros s'efface, le panneau des suggestions a la place
  // au-dessus du clavier.
  const searchRowY = useRef(0);
  const onSearchRowY = useCallback((y: number) => { searchRowY.current = y; }, []);
  useEffect(() => {
    if (!assist.focused) return;
    ref.current?.scrollToOffset({ offset: Math.max(0, searchRowY.current - spacing.sm - searchDockOffset), animated: true });
  }, [assist.focused, ref, searchDockOffset]);

  const header = (
    <View>
      <LibraryHero library={library} topInset={topInset} />
      {capsule}
      <LibrarySearchRow state={state} libraryName={library.Name} onLayoutY={onSearchRowY} />
      {/* Pendant la frappe, les suggestions prennent la place des filtres et de la grille. */}
      {assist.open ? (
        <>
          <SearchAssistPane assist={assist} inline />
          {/* La grille s'efface pendant la frappe : sans cette réserve, la liste
              raccourcie redescendrait et le panneau passerait sous la barre. */}
          <View style={{ height: windowH }} />
        </>
      ) : (
        <>
          {/* Le total est déjà sous le titre : le compte ne revient qu'avec un filtre. */}
          <LibraryFilterBar state={state} quick showCount={state.isFiltered} />
          {emptySearch && <ScopedSearchEmpty query={state.debouncedSearch} onApply={state.setSearchQuery} />}
        </>
      )}
    </View>
  );

  const hideGrid = assist.open || emptySearch;
  return (
    <>
      <CatalogGrid
        listRef={ref}
        catalog={catalog}
        onItemPress={openItem}
        overrideItems={hideGrid ? NONE : state.platformActive ? state.platformFiltered : undefined}
        empty={hideGrid ? null : undefined}
        header={header}
        onScroll={onScroll}
        topInset={topInset}
        bottomInset={bottomInset}
        filtered={state.isFiltered}
        onReset={resetAll}
      />
      <LibrarySheets state={state} />
    </>
  );
}
