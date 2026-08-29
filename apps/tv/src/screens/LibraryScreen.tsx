import { useCallback, useMemo, useState } from "react";
import { View, TVFocusGuideView } from "react-native";
import { useGenres, useLibraries, useLibraryCatalog } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { TV_BANNER_CARD } from "@tentacle-tv/theme";
import { useTranslation } from "react-i18next";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { usePreventRemove } from "@react-navigation/native";
import type { RootStackParamList } from "../navigation/types";
import { Skeleton } from "../components/SkeletonLoader";
import { useTVRemote } from "../components/focus/useTVRemote";
import { useTVContentEntry } from "../hooks/useTVContentEntry";
import { TVScreenFrame } from "../components/nav/TVScreenFrame";
import { TVLibraryGrid, useTVGridLayout } from "../components/library/TVLibraryGrid";
import { TVLibraryHero } from "../components/library/TVLibraryHero";
import { TVLibraryEmpty } from "../components/library/TVLibraryEmpty";
import { TVLibraryFilterBar, type FilterMenuKind } from "../components/library/TVLibraryFilterBar";
import type { MenuAnchor } from "../components/library/TVLibraryFilterMenu";
import { TVSortMenu, TVGenreMenu } from "../components/library/TVLibrarySortGenreMenus";
import { TVYearMenu, TVRatingMenu } from "../components/library/TVLibraryRangeMenus";
import { TVPlatformMenu } from "../components/library/TVLibraryPlatformMenu";
import { AmbientFocusProvider, usePoseurAmbiant } from "../contexts/AmbientFocusContext";
import { TVAmbientBackdrop } from "../components/ambient/TVAmbientBackdrop";
import { useLibraryFilters } from "../hooks/useLibraryFilters";
import { filtrePlateformeActif } from "../hooks/libraryCatalogParams";
import { usePlatformFilter } from "../hooks/usePlatformFilter";
import { possessiveLibraryName } from "../utils/libraryLabel";
import { Spacing } from "../theme/colors";

type Props = NativeStackScreenProps<RootStackParamList, "Library">;

export function LibraryScreen(props: Props) {
  return (
    <AmbientFocusProvider>
      <LibraryScreenInner {...props} />
    </AmbientFocusProvider>
  );
}

function LibraryScreenInner({ route, navigation }: Props) {
  const { libraryId, libraryName } = route.params;
  const { i18n } = useTranslation("common");
  const displayName = possessiveLibraryName(libraryName, i18n.language);
  const setFocusedItem = usePoseurAmbiant();

  const lf = useLibraryFilters(libraryId);
  const [openMenu, setOpenMenu] = useState<{ kind: FilterMenuKind; anchor: MenuAnchor } | null>(null);

  const { data: genresList } = useGenres(libraryId);
  const { data: libraries } = useLibraries();
  const collectionType = libraries?.find((l) => l.Id === libraryId)?.CollectionType;

  const platformActive = filtrePlateformeActif(lf.filters);
  // Les paramètres ne sont PAS écrits ici : ils viennent de `catalogueParams`,
  // la même fabrication que le préchargement du rail. Recopiés des deux côtés,
  // ils divergeaient — et le préchargement visait une clé de cache que cet
  // écran ne demandait jamais (cf. `libraryCatalogParams`).
  const { data, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useLibraryCatalog(libraryId, lf.params);

  const allItems = useMemo(() => data?.pages.flatMap((p) => p.Items) ?? [], [data]);
  const { filteredItems } = usePlatformFilter(allItems, lf.filters.platformIds);
  const items = platformActive ? filteredItems : allItems;
  const total = platformActive
    ? filteredItems.length
    : data?.pages[0]?.TotalRecordCount ?? undefined;

  // Un seul propriétaire du Retour : menu ouvert → le fermer ; sinon quitter.
  useTVRemote({
    onBack: () => {
      if (openMenu) setOpenMenu(null);
      else navigation.goBack();
    },
  });

  // tvOS : le bouton Menu déclenche le POP NATIF sans jamais passer par le JS
  // (le BackHandler de useTVRemote est Android only). Menu de filtre ouvert →
  // bloquer le pop et ne fermer QUE le menu — sans quoi Retour depuis un menu
  // quittait toute la bibliothèque.
  usePreventRemove(openMenu != null, () => setOpenMenu(null));

  // Sélection d'une bibliothèque au rail → focus sur la 1ʳᵉ carte.
  const contentEntry = useTVContentEntry();

  const navigateToDetail = useCallback((item: MediaItem) => {
    navigation.navigate("MediaDetail", { itemId: item.Id });
  }, [navigation]);

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const openMenuAt = useCallback((kind: FilterMenuKind, anchor: MenuAnchor) => {
    setOpenMenu({ kind, anchor });
  }, []);

  const header = useMemo(() => (
    <View>
      <TVLibraryHero libraryId={libraryId} libraryName={displayName} collectionType={collectionType} />
      {/* L'écart carte → filtres de la LG (28). */}
      <View style={{ marginTop: TV_BANNER_CARD.filtersGap }}>
        <TVLibraryFilterBar
          filters={lf.filters}
          hasActiveFilters={lf.hasActiveFilters}
          totalResults={total}
          onStatusChange={lf.setStatusFilter}
          onFavoriteChange={lf.setIsFavorite}
          onOpenMenu={openMenuAt}
          onReset={lf.resetFilters}
        />
      </View>
    </View>
  ), [libraryId, displayName, collectionType, lf.filters, lf.hasActiveFilters, lf.setStatusFilter, lf.setIsFavorite, lf.resetFilters, total, openMenuAt]);

  return (
    <TVScreenFrame>
      <TVAmbientBackdrop />
      {/* @ts-expect-error — TVFocusGuideView (react-native-tvos). `autoFocus` le
          rend guide de focus au sens du moteur natif : il devient le plus proche
          ancêtre de la grille, donc celui vers qui la récupération de focus se
          tourne quand la cellule focalisée se démonte — un filtre qui ne rend
          plus rien, par exemple. Sans lui, la télécommande devenait muette. */}
      <TVFocusGuideView autoFocus style={{ flex: 1 }}>
        {isLoading && items.length === 0 ? (
          <LibraryLoading header={header} />
        ) : (
          /* La grille est rendue MÊME vide : son état vide vit dedans, ce qui
             garde la barre de filtres montée quand le dernier résultat
             disparaît — sans quoi la puce qu'on vient d'actionner est démontée
             sous le doigt et le focus s'en va dans le rail. */
          <TVLibraryGrid
            listKey={libraryId}
            items={items}
            header={header}
            onPressItem={navigateToDetail}
            onItemFocus={setFocusedItem}
            onEndReached={handleEndReached}
            isFetchingNextPage={isFetchingNextPage}
            entryRef={contentEntry}
            emptyComponent={
              <TVLibraryEmpty
                filtree={lf.hasActiveFilters}
                onReinitialiser={lf.resetFilters}
                onParcourir={() => navigation.navigate("Home")}
                entryRef={contentEntry}
              />
            }
          />
        )}
      </TVFocusGuideView>

      {openMenu?.kind === "sort" && (
        <TVSortMenu anchor={openMenu.anchor} filters={lf.filters} onSortByChange={lf.setSortBy} onSortOrderChange={lf.setSortOrder} />
      )}
      {openMenu?.kind === "genres" && (
        <TVGenreMenu anchor={openMenu.anchor} genres={genresList ?? []} selectedIds={lf.filters.genreIds} onToggle={lf.toggleGenre} />
      )}
      {openMenu?.kind === "years" && (
        <TVYearMenu anchor={openMenu.anchor} yearFrom={lf.filters.yearFrom} yearTo={lf.filters.yearTo} onYearFromChange={lf.setYearFrom} onYearToChange={lf.setYearTo} />
      )}
      {openMenu?.kind === "rating" && (
        <TVRatingMenu anchor={openMenu.anchor} ratingMin={lf.filters.ratingMin} onRatingMinChange={lf.setRatingMin} />
      )}
      {openMenu?.kind === "platforms" && (
        <TVPlatformMenu anchor={openMenu.anchor} selectedIds={lf.filters.platformIds} onToggle={lf.togglePlatform} />
      )}
    </TVScreenFrame>
  );
}

/** Le squelette de chargement, à la géométrie de la vraie grille. */
function LibraryLoading({ header }: { header: React.ReactElement }) {
  const { cardW, cardH } = useTVGridLayout();
  return (
    <View style={{ paddingHorizontal: Spacing.rowGutter }}>
      {header}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} width={cardW} height={cardH} />
        ))}
      </View>
    </View>
  );
}
