import { useCallback, useMemo, useState } from "react";
import { View, Text, SectionList, StyleSheet, ScrollView, RefreshControl, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { summarizeFavorites, useBatchRemoveFavorites, useFavoritesAll, useJellyfinClient } from "@tentacle-tv/api-client";
import { cardRatingFor, type MediaItem } from "@tentacle-tv/shared";
import { backOrHome } from "@/utils/backOrHome";
import { FadeIn, SkeletonCard, SubtleBackground } from "@/components/ui";
import { MediaActionSheet } from "@/components/MediaActionSheet";
import { SelectionBar } from "@/components/SelectionBar";
import { ListHeader } from "@/components/watchlist/ListHeader";
import { SelectableGridCard } from "@/components/watchlist/SelectableGridCard";
import { CollectionFilterHeader } from "@/components/collection/CollectionFilterHeader";
import { FavoritesEmptyState } from "@/components/favorites/FavoritesEmptyState";
import { FavoritesQuickRow } from "@/components/favorites/FavoritesQuickRow";
import { FavoritesSectionHeader } from "@/components/favorites/FavoritesSectionHeader";
import { ScopedSearchEmpty } from "@/components/search/ScopedSearchEmpty";
import { SearchAssistPane } from "@/components/search/SearchAssistPane";
import { useSearchAssist } from "@/components/search/useSearchAssist";
import { useMultiSelect } from "@/hooks/useMultiSelect";
import { useCollectionFilters } from "./collection/useCollectionFilters";
import { useFavoriteSections, type FavoriteSection } from "./favorites/useFavoriteSections";
import { spacing, typography, FONT_FAMILY, useGrid, useTheme, useThemedStyles, type AppTheme } from "@/theme";

const POSTER_ASPECT = 2 / 3;

/**
 * « Mes favoris » — les titres likés.
 *
 * L'en-tête et la barre de filtres de Ma liste (mêmes composants), puis ce
 * qui n'appartient qu'aux favoris : deux tuiles d'état qui comptent et
 * filtrent, « Regrouper » (type, visionnage, genre, décennie), une grille en
 * sections repliables, et une vraie page vide. Tuiles et regroupement défilent
 * avec la grille : seule la barre de filtres reste en place.
 *
 * Tout ce que l'écran commun faisait est conservé : recherche avec
 * suggestions, filtres et tri, tirer pour rafraîchir, appui long (feuille
 * d'actions), sélection et retrait en lot.
 */
export function FavoritesScreen() {
  const { t } = useTranslation(["common", "favorites"]);
  const { colors } = useTheme();
  const st = useThemedStyles(makeStyles);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const client = useJellyfinClient();
  const { data: raw, isLoading, refetch, isRefetching } = useFavoritesAll();
  const batchRemove = useBatchRemoveFavorites();
  const filters = useCollectionFilters(raw);
  const assist = useSearchAssist(filters.input, filters.setInput);
  const data = filters.filtered;
  const { numColumns, itemWidth: cardWidth, gutter, padding } = useGrid({ phoneColumns: 3 });
  const { mode, setMode, sections, toggle } = useFavoriteSections(data, numColumns);
  const summary = useMemo(() => summarizeFavorites(raw ?? []), [raw]);
  const selection = useMultiSelect<string>();
  const [sheetItemId, setSheetItemId] = useState<string | null>(null);

  const handlePress = useCallback((item: MediaItem) => {
    if (selection.active) selection.toggle(item.Id);
    else router.push(`/media/${item.Id}`);
  }, [router, selection]);

  const handleLongPress = useCallback((item: MediaItem) => {
    if (!selection.active) setSheetItemId(item.Id);
  }, [selection.active]);

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
          posterUri={client.getImageUrl(item.Id, "Primary", { width: 300, quality: 80 })}
          title={item.Name}
          year={item.ProductionYear ?? null}
          progressPercent={item.UserData?.PlayedPercentage ?? null}
          watched={item.UserData?.Played === true}
          rating={cardRatingFor(item, "series").rating}
          width={cardWidth}
          selectable={selection.active}
          selected={selection.selected.has(item.Id)}
          onPress={() => handlePress(item)}
          onLongPress={() => handleLongPress(item)}
        />
      ))}
    </View>
  ), [st.row, gutter, padding, client, cardWidth, selection.active, selection.selected, handlePress, handleLongPress]);

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
  const hours = Math.floor(summary.movieMinutes / 60);
  const subtitle = isLoading || totalRaw === 0
    ? ""
    : [t("itemCount", { count }), hours > 0 ? t("favorites:summaryMovieHours", { count: hours }) : null].filter(Boolean).join(" · ");
  const showControls = !selection.active && !isLoading && totalRaw > 0;
  const refresh = <RefreshControl refreshing={isRefetching} onRefresh={selection.active ? undefined : refetch} tintColor={colors.brand.violet} />;

  const quickRow = showControls ? (
    <FavoritesQuickRow
      items={raw ?? []}
      type={filters.state.type}
      status={filters.state.statusFilter}
      onStatusChange={(statusFilter) => filters.patch({ statusFilter })}
      groupMode={mode}
      onGroupModeChange={setMode}
    />
  ) : null;

  let body: React.ReactNode;
  if (assist.open) {
    body = <SearchAssistPane assist={assist} />;
  } else if (isLoading) {
    const cardH = cardWidth / POSTER_ASPECT;
    body = (
      <View style={[st.skeletonGrid, { gap: gutter, paddingHorizontal: padding }]}>
        {Array.from({ length: numColumns * 3 }).map((_, i) => (
          <View key={i} style={{ width: cardWidth, marginBottom: spacing.sm }}>
            <SkeletonCard width={cardWidth} height={cardH} />
          </View>
        ))}
      </View>
    );
  } else if (count === 0) {
    body = (
      <ScrollView contentContainerStyle={st.emptyScroll} refreshControl={refresh} showsVerticalScrollIndicator={false}>
        {totalRaw === 0 ? (
          <FavoritesEmptyState />
        ) : (
          <>
            {quickRow}
            {filters.state.search.length >= 2 ? (
              <ScopedSearchEmpty query={filters.state.search} onApply={filters.setInput} external={false} />
            ) : (
              <View style={st.noResults}>
                <Feather name="heart" size={40} color={colors.brand.light} style={{ opacity: 0.6 }} />
                <Text style={st.noResultsTitle}>{t("noResults")}</Text>
                <Text style={st.noResultsHint}>{t("noResultsHint")}</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => { filters.reset(); filters.patch({ type: "all" }); }}
                  style={({ pressed }) => [st.resetBtn, pressed && { opacity: 0.8 }]}
                >
                  <Text style={st.resetText}>{t("resetFilters")}</Text>
                </Pressable>
              </View>
            )}
          </>
        )}
      </ScrollView>
    );
  } else {
    body = (
      <FadeIn delay={80} style={{ flex: 1 }}>
        <SectionList
          key={`favorites-${numColumns}`}
          sections={sections}
          keyExtractor={(row) => row[0]?.Id ?? "empty"}
          renderItem={renderRow}
          renderSectionHeader={renderSectionHeader}
          stickySectionHeadersEnabled={false}
          ListHeaderComponent={quickRow}
          contentContainerStyle={[st.listContent, selection.active && { paddingBottom: spacing.xxxl + 100 }]}
          refreshControl={refresh}
          showsVerticalScrollIndicator={false}
        />
      </FadeIn>
    );
  }

  return (
    <SubtleBackground ambient>
      <View style={[st.container, { paddingTop: Math.max(insets.top, 24) }]}>
        <ListHeader
          title={t("myFavorites")}
          subtitle={subtitle}
          titleIcon="heart"
          onBack={() => backOrHome(router)}
          onEnterSelection={selection.enter}
          canSelect={count > 0 && !selection.active}
        />
        {showControls && <CollectionFilterHeader filters={filters} assist={assist} />}
        {body}

        {sheetItemId && (
          <MediaActionSheet visible itemId={sheetItemId} onClose={() => setSheetItemId(null)} />
        )}
        {selection.active && (
          <SelectionBar
            count={selection.count}
            totalCount={count}
            onSelectAll={handleSelectAll}
            onDelete={handleDelete}
            onCancel={selection.clear}
          />
        )}
      </View>
    </SubtleBackground>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    container: { flex: 1 },
    row: { flexDirection: "row", marginBottom: spacing.sm },
    skeletonGrid: { flexDirection: "row", flexWrap: "wrap" },
    listContent: { paddingBottom: spacing.xxxl + 60 },
    emptyScroll: { paddingBottom: spacing.xxxl + 60 },
    noResults: { alignItems: "center", paddingTop: 48, paddingHorizontal: spacing.screenPadding, gap: spacing.sm },
    noResultsTitle: { ...typography.subtitle, fontFamily: FONT_FAMILY.bold, fontSize: 18, color: t.colors.text.primary, marginTop: spacing.md, letterSpacing: -0.3 },
    noResultsHint: { ...typography.caption, fontFamily: FONT_FAMILY.regular, color: t.colors.text.tertiary, textAlign: "center", maxWidth: 280 },
    resetBtn: { marginTop: spacing.md, minHeight: 44, paddingHorizontal: spacing.lg, borderRadius: 999, justifyContent: "center", backgroundColor: t.colors.brand.soft },
    resetText: { fontSize: 14, fontFamily: FONT_FAMILY.semibold, color: t.colors.brand.light },
  });
