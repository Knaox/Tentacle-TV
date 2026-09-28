import { useCallback, useMemo, useRef } from "react";
import { RefreshControl, ScrollView, SectionList, StyleSheet, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { summarizeFavorites, useBatchRemoveFavorites, useFavoritesAll } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { backOrHome } from "@/utils/backOrHome";
import { SkeletonCard, SubtleBackground } from "@/components/ui";
import { SelectionBar } from "@/components/SelectionBar";
import { useCardSheetOpener } from "@/components/cards/sheet/cardSheetContext";
import { posterSheetTarget } from "@/components/cards/sheet/cardSheetTarget";
import { CatalogEmpty } from "@/components/catalog/CatalogGridStates";
import { CollectionControls } from "@/components/collection/CollectionControls";
import { CollectionHero } from "@/components/collection/CollectionHero";
import { QuickChip, QuickChipText } from "@/components/collection/QuickChip";
import { FavoritesEmptyState } from "@/components/favorites/FavoritesEmptyState";
import { FavoritesQuickRow } from "@/components/favorites/FavoritesQuickRow";
import { FavoritesSectionHeader } from "@/components/favorites/FavoritesSectionHeader";
import { FloatingBackButton } from "@/components/navigation/FloatingBackButton";
import { SelectableGridCard } from "@/components/watchlist/SelectableGridCard";
import { ShareMyListButton } from "@/components/watchlist/ShareMyListButton";
import { ScopedSearchEmpty } from "@/components/search/ScopedSearchEmpty";
import { SearchAssistPane } from "@/components/search/SearchAssistPane";
import { useSearchAssist } from "@/components/search/useSearchAssist";
import { useMultiSelect } from "@/hooks/useMultiSelect";
import { useCollectionFilters } from "./collection/useCollectionFilters";
import { useSearchDock } from "./collection/useSearchDock";
import { useFavoriteSections, type FavoriteSection } from "./favorites/useFavoriteSections";
import { spacing, useGrid, useTheme, useThemedStyles } from "@/theme";

const POSTER_ASPECT = 2 / 3;
const NO_SECTIONS: FavoriteSection[] = [];

/**
 * « Mes favoris » — les titres likés, À LA FORME de la Bibliothèque et de Ma
 * liste : tout défile d'un seul tenant — l'ambiance, le titre et son bilan,
 * Partager et Sélectionner ; le champ, « Trier et filtrer » et la barre rapide
 * (type, tri) ; puis ce qui n'appartient qu'aux favoris : deux tuiles d'état
 * qui comptent et filtrent, « Regrouper » (type, visionnage, genre, décennie),
 * et la grille en sections repliables. Le retour flottant reste à portée.
 *
 * Rien de retiré : recherche avec suggestions, filtres et tri, tirer pour
 * rafraîchir, appui long (feuille d'actions), sélection et retrait en lot,
 * vraie page vide — qui propose maintenant le partage des titres likés.
 */
export function FavoritesScreen() {
  const { t } = useTranslation(["common", "favorites"]);
  const { colors } = useTheme();
  const st = useThemedStyles(makeStyles);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: windowH } = useWindowDimensions();
  const { data: raw, isLoading, refetch, isRefetching } = useFavoritesAll();
  const batchRemove = useBatchRemoveFavorites();
  const filters = useCollectionFilters(raw);
  const assist = useSearchAssist(filters.input, filters.setInput);
  const data = filters.filtered;
  const { numColumns, itemWidth: cardWidth, gutter, padding } = useGrid({ phoneColumns: 3 });
  const { mode, setMode, sections, toggle } = useFavoriteSections(data, numColumns);
  const summary = useMemo(() => summarizeFavorites(raw ?? []), [raw]);
  const selection = useMultiSelect<string>();
  const openSheet = useCardSheetOpener();
  const top = Math.max(insets.top, 24);
  const listRef = useRef<SectionList<MediaItem[], FavoriteSection>>(null);
  // Une `SectionList` n'a pas `scrollToOffset` : on passe par sa liste interne.
  const scroller = useMemo(() => ({
    scrollToOffset: (p: { offset: number; animated?: boolean }) =>
      listRef.current?.getScrollResponder()?.scrollTo({ y: p.offset, animated: p.animated }),
  }), []);
  const scrollerRef = useRef(scroller);
  const onControlsY = useSearchDock(scrollerRef, assist.focused);

  const handlePress = useCallback((item: MediaItem) => {
    if (selection.active) selection.toggle(item.Id);
    else router.push(`/media/${item.Id}`);
  }, [router, selection]);
  // En sélection, l'appui long ne fait rien : il cocherait par mégarde.
  const handleLongPress = useCallback((item: MediaItem) => {
    if (!selection.active) openSheet?.(posterSheetTarget(item));
  }, [selection.active, openSheet]);
  const handleDelete = useCallback(async () => {
    const ids = Array.from(selection.selected);
    if (ids.length === 0) return;
    await batchRemove.mutateAsync(ids);
    selection.clear();
  }, [selection, batchRemove]);
  // « Tout sélectionner » porte sur ce qui est FILTRÉ : c'est ce que l'écran montre.
  const handleSelectAll = useCallback(() => {
    if (selection.count === data.length) selection.selectAll([]);
    else selection.selectAll(data.map((i) => i.Id));
  }, [data, selection]);

  const renderRow = useCallback(({ item: row }: { item: MediaItem[] }) => (
    <View style={[st.row, { gap: gutter, paddingHorizontal: padding }]}>
      {row.map((item) => (
        <SelectableGridCard
          key={item.Id}
          item={item}
          width={cardWidth}
          selectable={selection.active}
          selected={selection.selected.has(item.Id)}
          onPress={() => handlePress(item)}
          onLongPress={() => handleLongPress(item)}
        />
      ))}
    </View>
  ), [st.row, gutter, padding, cardWidth, selection.active, selection.selected, handlePress, handleLongPress]);

  const renderSectionHeader = useCallback(({ section }: { section: FavoriteSection }) => (
    section.headed ? (
      <FavoritesSectionHeader
        title={section.title}
        count={section.count}
        collapsed={section.collapsed}
        first={section.first}
        onToggle={() => toggle(section.key)}
      />
    ) : null
  ), [toggle]);

  const count = data.length;
  const totalRaw = raw?.length ?? 0;
  const hasContent = !isLoading && totalRaw > 0;
  const hours = Math.floor(summary.movieMinutes / 60);
  const subtitle = !hasContent
    ? ""
    : [t("itemCount", { count: summary.total }), hours > 0 ? t("favorites:summaryMovieHours", { count: hours }) : null].filter(Boolean).join(" · ");
  const refresh = <RefreshControl refreshing={isRefetching} onRefresh={selection.active ? undefined : refetch} tintColor={colors.brand.violet} />;

  const hero = (
    <CollectionHero
      items={raw}
      title={t("myFavorites")}
      kicker={t("favorites:kicker")}
      icon="heart"
      subtitle={subtitle}
      topInset={top}
      actions={hasContent && !selection.active ? (
        <>
          <ShareMyListButton kind="likes" />
          {count > 0 && (
            <QuickChip onPress={selection.enter}>
              <Feather name="check-square" size={14} color={colors.brand.light} />
              <QuickChipText>{t("select")}</QuickChipText>
            </QuickChip>
          )}
        </>
      ) : undefined}
    />
  );

  const header = (
    <View>
      {hero}
      {!selection.active && (
        <View onLayout={(e) => onControlsY(e.nativeEvent.layout.y)}>
          <CollectionControls filters={filters} assist={assist} name={t("myFavorites")} />
        </View>
      )}
      {assist.open ? (
        <>
          <SearchAssistPane assist={assist} inline />
          <View style={{ height: windowH }} />
        </>
      ) : !selection.active ? (
        <FavoritesQuickRow
          items={raw ?? []}
          type={filters.state.type}
          status={filters.state.statusFilter}
          onStatusChange={(statusFilter) => filters.patch({ statusFilter })}
          groupMode={mode}
          onGroupModeChange={setMode}
        />
      ) : null}
    </View>
  );

  const emptyBody = filters.state.search.length >= 2 ? (
    <ScopedSearchEmpty query={filters.state.search} onApply={filters.setInput} external={false} />
  ) : (
    <CatalogEmpty filtered onReset={() => { filters.reset(); filters.patch({ type: "all" }); }} />
  );

  let skeleton: React.ReactNode = null;
  if (isLoading) {
    const cardH = cardWidth / POSTER_ASPECT;
    skeleton = (
      <View style={[st.skeletonGrid, { gap: gutter, paddingHorizontal: padding }]}>
        {Array.from({ length: numColumns * 3 }).map((_, i) => (
          <View key={i} style={{ width: cardWidth, marginBottom: spacing.sm }}>
            <SkeletonCard width={cardWidth} height={cardH} />
          </View>
        ))}
      </View>
    );
  }

  return (
    <SubtleBackground ambient>
      <View style={st.container}>
        {!hasContent ? (
          <ScrollView
            contentContainerStyle={[st.listContent, { paddingTop: top }]}
            refreshControl={isLoading ? undefined : refresh}
            showsVerticalScrollIndicator={false}
          >
            {hero}
            {isLoading ? skeleton : <FavoritesEmptyState />}
          </ScrollView>
        ) : (
          <SectionList
            ref={listRef}
            key={`favorites-${numColumns}`}
            sections={assist.open || count === 0 ? NO_SECTIONS : sections}
            keyExtractor={(row) => row[0]?.Id ?? "empty"}
            renderItem={renderRow}
            renderSectionHeader={renderSectionHeader}
            stickySectionHeadersEnabled={false}
            ListHeaderComponent={header}
            ListEmptyComponent={assist.open ? null : emptyBody}
            contentContainerStyle={[st.listContent, { paddingTop: top }, selection.active && { paddingBottom: spacing.xxxl + 100 }]}
            keyboardShouldPersistTaps="handled"
            refreshControl={refresh}
            showsVerticalScrollIndicator={false}
          />
        )}

        <FloatingBackButton top={top} onPress={() => backOrHome(router)} />
        {selection.active && (
          <SelectionBar count={selection.count} totalCount={count} onSelectAll={handleSelectAll} onDelete={handleDelete} onCancel={selection.clear} />
        )}
      </View>
    </SubtleBackground>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    container: { flex: 1 },
    row: { flexDirection: "row", marginBottom: spacing.sm },
    skeletonGrid: { flexDirection: "row", flexWrap: "wrap" },
    listContent: { paddingBottom: spacing.xxxl + 60 },
  });
