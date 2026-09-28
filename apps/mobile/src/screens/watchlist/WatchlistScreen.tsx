import { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBatchRemoveWatchlist, useJellyfinClient, useWatchlistAll } from "@tentacle-tv/api-client";
import { cardRatingFor, type MediaItem } from "@tentacle-tv/shared";
import { backOrHome } from "@/utils/backOrHome";
import { FadeIn, Skeleton, SkeletonCard, SubtleBackground } from "@/components/ui";
import { MediaActionSheet } from "@/components/MediaActionSheet";
import { SelectionBar } from "@/components/SelectionBar";
import { ListHeader } from "@/components/watchlist/ListHeader";
import { SelectableGridCard } from "@/components/watchlist/SelectableGridCard";
import { ShareMyListButton } from "@/components/watchlist/ShareMyListButton";
import { StageBar } from "@/components/watchlist/StageBar";
import { ResumeRail } from "@/components/watchlist/ResumeRail";
import { WatchlistListRow } from "@/components/watchlist/WatchlistListRow";
import { UndoBar, WatchlistEmptyState } from "@/components/watchlist/WatchlistFeedback";
import { CollectionFilterHeader } from "@/components/collection/CollectionFilterHeader";
import { ScopedSearchEmpty } from "@/components/search/ScopedSearchEmpty";
import { SearchAssistPane } from "@/components/search/SearchAssistPane";
import { useSearchAssist } from "@/components/search/useSearchAssist";
import { useMultiSelect } from "@/hooks/useMultiSelect";
import { spacing, FONT_FAMILY, useGrid, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import { usePlayFromWatchlist, useSummaryLine, useWatchlistScreen } from "./useWatchlistScreen";

const STAGE_EMPTY = { new: "stageEmptyNew", inProgress: "stageEmptyInProgress", watched: "stageEmptyWatched" } as const;

/**
 * Ma liste : en-tête chiffré, partage, étapes de visionnage et bascule grille
 * / liste, filtres de collection ; puis « Reprendre » en tête de la liste
 * défilante, et la collection — en grille (`SelectableGridCard`, inchangée) ou
 * en lignes avec Lire et Retirer. Retrait annulable, état vide à deux chemins.
 *
 * Mes favoris a son propre écran (`screens/favorites`).
 */
export function WatchlistScreen() {
  const { t } = useTranslation("common");
  const { t: tw } = useTranslation("watchlist");
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const client = useJellyfinClient();
  const { data: raw, isLoading, refetch, isRefetching } = useWatchlistAll();
  const batchRemove = useBatchRemoveWatchlist();
  const page = useWatchlistScreen(raw);
  const { filters, stage, visible: data } = page;
  const assist = useSearchAssist(filters.input, filters.setInput);
  const selection = useMultiSelect<string>();
  const { play, pendingId } = usePlayFromWatchlist();
  const [removed, setRemoved] = useState<MediaItem | null>(null);
  const clearRemoved = useCallback(() => setRemoved(null), []);
  const [sheetId, setSheetId] = useState<string | null>(null);
  const { numColumns, itemWidth, gutter, padding } = useGrid({ phoneColumns: 3 });
  const summaryLine = useSummaryLine(page.summary);
  const isList = page.view === "list";

  const handlePress = useCallback((item: MediaItem) => {
    if (selection.active) selection.toggle(item.Id);
    else router.push(`/media/${item.Id}`);
  }, [router, selection]);
  const handleLongPress = useCallback((item: MediaItem) => {
    if (!selection.active) setSheetId(item.Id);
  }, [selection.active]);
  const handleDelete = useCallback(async () => {
    const ids = Array.from(selection.selected);
    if (ids.length === 0) return;
    await batchRemove.mutateAsync(ids);
    selection.clear();
  }, [selection, batchRemove]);
  // « Tout sélectionner » porte sur ce qui est montré : filtres ET étape.
  const handleSelectAll = useCallback(() => {
    if (selection.count === data.length) selection.selectAll([]);
    else selection.selectAll(data.map((i) => i.Id));
  }, [data, selection]);

  const renderItem = useCallback(({ item }: { item: MediaItem }) => isList ? (
    <View style={styles.rowWrap}>
      <WatchlistListRow
        item={item}
        selecting={selection.active}
        selected={selection.selected.has(item.Id)}
        pendingPlay={pendingId === item.Id}
        onPress={handlePress}
        onLongPress={handleLongPress}
        onPlay={play}
        onRemoved={setRemoved}
      />
    </View>
  ) : (
    <SelectableGridCard
      posterUri={client.getImageUrl(item.Id, "Primary", { width: 300, quality: 80 })}
      title={item.Name}
      year={item.ProductionYear ?? null}
      progressPercent={item.UserData?.PlayedPercentage ?? null}
      watched={item.UserData?.Played === true}
      rating={cardRatingFor(item, "series").rating}
      width={itemWidth}
      selectable={selection.active}
      selected={selection.selected.has(item.Id)}
      onPress={() => handlePress(item)}
      onLongPress={() => handleLongPress(item)}
    />
  ), [isList, styles.rowWrap, selection.active, selection.selected, pendingId, handlePress, handleLongPress, play, client, itemWidth]);

  // Le squelette prend la forme de l'affichage choisi : l'écran ne saute pas
  // quand les titres arrivent.
  const skeletons = useMemo(() => isList
    ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} width="100%" height={100} radius={16} />)
    : Array.from({ length: numColumns * 3 }).map((_, i) => (
      <View key={i} style={{ width: itemWidth, marginBottom: spacing.sm }}>
        <SkeletonCard width={itemWidth} height={itemWidth * 1.5} />
      </View>
    )), [isList, numColumns, itemWidth]);

  const totalRaw = raw?.length ?? 0;
  const hasContent = !isLoading && totalRaw > 0;
  const showResume = !selection.active && stage === "all" && !filters.isFiltered;
  const cols = isList ? 1 : numColumns;

  const emptyBody = stage !== "all" && filters.filtered.length > 0 ? (
    <View style={styles.message}>
      <Text style={styles.messageText}>{tw(STAGE_EMPTY[stage])}</Text>
      <Pressable onPress={() => page.setStage("all")} accessibilityRole="button" style={styles.messageBtn}>
        <Text style={styles.messageBtnText}>{tw("showAll")}</Text>
      </Pressable>
    </View>
  ) : filters.state.search.length >= 2 ? (
    <ScopedSearchEmpty query={filters.state.search} onApply={filters.setInput} external={false} />
  ) : (
    <View style={styles.message}>
      <Text style={styles.messageTitle}>{t("noResults")}</Text>
      <Text style={styles.messageText}>{t("noResultsHint")}</Text>
    </View>
  );

  return (
    <SubtleBackground ambient>
      <View style={[styles.container, { paddingTop: Math.max(insets.top, 24) }]}>
        <ListHeader
          title={t("myList")}
          subtitle={hasContent ? summaryLine : ""}
          titleIcon="bookmark"
          onBack={() => backOrHome(router)}
          onEnterSelection={selection.enter}
          canSelect={data.length > 0 && !selection.active}
        />
        {hasContent && !selection.active && (
          <>
            <View style={styles.shareRow}><ShareMyListButton /></View>
            <StageBar stage={stage} onStageChange={page.setStage} counts={page.stageCounts} view={page.view} onViewChange={page.setView} />
            <CollectionFilterHeader filters={filters} assist={assist} />
          </>
        )}

        {assist.open ? (
          <SearchAssistPane assist={assist} />
        ) : isLoading ? (
          <View style={isList ? styles.skeletonList : [styles.skeletonGrid, { paddingHorizontal: padding, gap: gutter }]}>
            {skeletons}
          </View>
        ) : totalRaw === 0 ? (
          // Dans un défilement, pour garder le « tirer pour actualiser » de
          // l'ancien écran : une liste vide se recharge comme une pleine.
          <ScrollView
            contentContainerStyle={styles.emptyScroll}
            refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brand.violet} />}
            showsVerticalScrollIndicator={false}
          >
            <WatchlistEmptyState />
          </ScrollView>
        ) : (
          <FadeIn delay={80} style={styles.container}>
            <FlatList
              key={`watchlist-${cols}`}
              data={data}
              numColumns={cols}
              keyExtractor={(item) => item.Id}
              renderItem={renderItem}
              ListHeaderComponent={showResume ? <ResumeRail items={page.resume} onPlay={play} pendingId={pendingId} /> : null}
              ListEmptyComponent={emptyBody}
              contentContainerStyle={[styles.content, selection.active && { paddingBottom: spacing.xxxl + 100 }]}
              columnWrapperStyle={cols > 1 ? { gap: gutter, paddingHorizontal: padding } : undefined}
              ItemSeparatorComponent={isList ? RowGap : undefined}
              refreshControl={
                <RefreshControl refreshing={isRefetching} onRefresh={selection.active ? undefined : refetch} tintColor={colors.brand.violet} />
              }
              showsVerticalScrollIndicator={false}
            />
          </FadeIn>
        )}

        {sheetId && <MediaActionSheet visible itemId={sheetId} onClose={() => setSheetId(null)} />}
        {selection.active && (
          <SelectionBar count={selection.count} totalCount={data.length} onSelectAll={handleSelectAll} onDelete={handleDelete} onCancel={selection.clear} />
        )}
        {removed && <UndoBar item={removed} onClose={clearRemoved} />}
      </View>
    </SubtleBackground>
  );
}

function RowGap() {
  return <View style={{ height: spacing.sm }} />;
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    container: { flex: 1 },
    shareRow: { flexDirection: "row", paddingHorizontal: spacing.screenPadding, paddingBottom: spacing.sm },
    skeletonGrid: { flexDirection: "row", flexWrap: "wrap" },
    skeletonList: { paddingHorizontal: spacing.screenPadding, gap: spacing.sm },
    emptyScroll: { paddingBottom: spacing.xxxl + 60 },
    content: { paddingBottom: spacing.xxxl + 60 },
    rowWrap: { paddingHorizontal: spacing.screenPadding },
    message: { alignItems: "center", paddingTop: 64, paddingHorizontal: spacing.xl, gap: spacing.sm },
    messageTitle: { fontFamily: FONT_FAMILY.bold, fontSize: 18, color: t.colors.text.primary },
    messageText: { fontFamily: FONT_FAMILY.regular, fontSize: 14, color: t.colors.text.tertiary, textAlign: "center", maxWidth: 300 },
    messageBtn: {
      marginTop: spacing.sm,
      height: 44,
      paddingHorizontal: spacing.xl,
      borderRadius: 22,
      justifyContent: "center",
      backgroundColor: t.colors.fill.subtle,
    },
    messageBtnText: { fontFamily: FONT_FAMILY.semibold, fontSize: 14, color: t.colors.text.secondary },
  });
