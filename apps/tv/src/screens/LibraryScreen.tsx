import { useCallback, useMemo, useState } from "react";
import { View, Text, TVFocusGuideView } from "react-native";
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
import { TVLibraryFilterBar, type FilterMenuKind } from "../components/library/TVLibraryFilterBar";
import type { MenuAnchor } from "../components/library/TVLibraryFilterMenu";
import { TVSortMenu, TVGenreMenu } from "../components/library/TVLibrarySortGenreMenus";
import { TVYearMenu, TVRatingMenu } from "../components/library/TVLibraryRangeMenus";
import { TVPlatformMenu } from "../components/library/TVLibraryPlatformMenu";
import { AmbientFocusProvider, usePoseurAmbiant } from "../contexts/AmbientFocusContext";
import { TVAmbientBackdrop } from "../components/ambient/TVAmbientBackdrop";
import { useLibraryFilters } from "../hooks/useLibraryFilters";
import { usePlatformFilter } from "../hooks/usePlatformFilter";
import { possessiveLibraryName } from "../utils/libraryLabel";
import { Colors, Spacing, Typography } from "../theme/colors";

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
  const { t, i18n } = useTranslation("common");
  const displayName = possessiveLibraryName(libraryName, i18n.language);
  const setFocusedItem = usePoseurAmbiant();

  const lf = useLibraryFilters(libraryId);
  const [openMenu, setOpenMenu] = useState<{ kind: FilterMenuKind; anchor: MenuAnchor } | null>(null);

  const { data: genresList } = useGenres(libraryId);
  const { data: libraries } = useLibraries();
  const collectionType = libraries?.find((l) => l.Id === libraryId)?.CollectionType;

  const platformActive = lf.filters.platformIds.length > 0;
  // fields:"light" : payload minimum pour la grille. Plateformes actives →
  // limite montée à 500 : la base du post-filtre client (parité web).
  const { data, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } = useLibraryCatalog(libraryId, {
    sortBy: lf.filters.sortBy,
    sortOrder: lf.filters.sortOrder,
    genreIds: lf.filters.genreIds.length > 0 ? lf.filters.genreIds : undefined,
    years: lf.yearsParam,
    statusFilter: lf.filters.statusFilter ?? undefined,
    minCommunityRating: lf.filters.ratingMin ?? undefined,
    isFavorite: lf.filters.isFavorite || undefined,
    limit: platformActive ? 500 : 30,
    fields: "light",
  });

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
      <View style={{ marginTop: TV_BANNER_CARD.ecartFiltres }}>
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
      <TVFocusGuideView style={{ flex: 1 }}>
        {isLoading && items.length === 0 ? (
          <LibraryLoading header={header} />
        ) : !isLoading && items.length === 0 ? (
          <View>
            {header}
            <View style={{ alignItems: "center", paddingTop: 80 }}>
              <Text style={{ color: Colors.textTertiary, ...Typography.sectionTitle }}>
                {t("noResults")}
              </Text>
            </View>
          </View>
        ) : (
          <TVLibraryGrid
            listKey={libraryId}
            items={items}
            header={header}
            onPressItem={navigateToDetail}
            onItemFocus={setFocusedItem}
            onEndReached={handleEndReached}
            isFetchingNextPage={isFetchingNextPage}
            entryRef={contentEntry}
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
