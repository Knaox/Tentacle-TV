import { useCallback, useMemo, useRef, useState } from "react";
import { FlatList, RefreshControl, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useBatchRemoveWatchlist, useJellyfinClient, useWatchlistAll } from "@tentacle-tv/api-client";
import { cardRatingFor, type MediaItem } from "@tentacle-tv/shared";
import { backOrHome } from "@/utils/backOrHome";
import { SkeletonCard, SubtleBackground } from "@/components/ui";
import { SelectionBar } from "@/components/SelectionBar";
import { useCardSheetOpener } from "@/components/cards/sheet/cardSheetContext";
import { posterSheetTarget } from "@/components/cards/sheet/cardSheetTarget";
import { CatalogEmpty } from "@/components/catalog/CatalogGridStates";
import { CollectionControls } from "@/components/collection/CollectionControls";
import { CollectionHero } from "@/components/collection/CollectionHero";
import { CollectionNarrowEmpty, ListSkeleton } from "@/components/collection/CollectionStates";
import { QuickChip, QuickChipText } from "@/components/collection/QuickChip";
import { FloatingBackButton } from "@/components/navigation/FloatingBackButton";
import { SelectableGridCard } from "@/components/watchlist/SelectableGridCard";
import { ShareMyListButton } from "@/components/watchlist/ShareMyListButton";
import { StageBar } from "@/components/watchlist/StageBar";
import { ResumeRail } from "@/components/watchlist/ResumeRail";
import { WatchlistListRow } from "@/components/watchlist/WatchlistListRow";
import { UndoBar, WatchlistEmptyState } from "@/components/watchlist/WatchlistFeedback";
import { ScopedSearchEmpty } from "@/components/search/ScopedSearchEmpty";
import { SearchAssistPane } from "@/components/search/SearchAssistPane";
import { useSearchAssist } from "@/components/search/useSearchAssist";
import { useMultiSelect } from "@/hooks/useMultiSelect";
import { spacing, useGrid, useTheme, useThemedStyles } from "@/theme";
import { usePlayFromWatchlist, useSummaryLine, useWatchlistScreen } from "./useWatchlistScreen";
import { useSearchDock } from "@/screens/collection/useSearchDock";

const STAGE_EMPTY = { new: "stageEmptyNew", inProgress: "stageEmptyInProgress", watched: "stageEmptyWatched" } as const;
const NONE: MediaItem[] = [];

/**
 * Ma liste, À LA FORME de la Bibliothèque : tout défile d'un seul tenant —
 * l'ambiance, le titre et son résumé chiffré, Partager et Sélectionner ; le
 * champ et « Trier et filtrer » ; les étapes de visionnage (à la place du
 * statut) ; la barre rapide (type, tri, grille ou liste) ; « Reprendre » ; puis
 * la collection, en grille (`SelectableGridCard`, inchangée) ou en lignes
 * avec Lire et Retirer. Le retour flottant reste à portée du pouce. Retrait
 * annulable, état vide à deux chemins, tirer pour actualiser.
 */
export function WatchlistScreen() {
  const { t } = useTranslation(["common", "watchlist"]);
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: windowH } = useWindowDimensions();
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
  const openSheet = useCardSheetOpener();
  const { numColumns, itemWidth, gutter, padding } = useGrid({ phoneColumns: 3 });
  const summaryLine = useSummaryLine(page.summary);
  const isList = page.view === "list";
  const top = Math.max(insets.top, 24);
  const listRef = useRef<FlatList<MediaItem>>(null);
  const onControlsY = useSearchDock(listRef, assist.focused);

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
  const skeleton = useMemo(() => isList ? <ListSkeleton /> : (
    <View style={[styles.skeletonGrid, { paddingHorizontal: padding, gap: gutter }]}>
      {Array.from({ length: numColumns * 3 }).map((_, i) => (
        <View key={i} style={{ width: itemWidth, marginBottom: spacing.sm }}>
          <SkeletonCard width={itemWidth} height={itemWidth * 1.5} />
        </View>
      ))}
    </View>
  ), [isList, styles.skeletonGrid, padding, gutter, numColumns, itemWidth]);

  const totalRaw = raw?.length ?? 0;
  const hasContent = !isLoading && totalRaw > 0;
  const showResume = !selection.active && stage === "all" && !filters.isFiltered;
  const cols = isList ? 1 : numColumns;
  const nextView = isList ? "grid" : "list";

  const hero = (
    <CollectionHero
      items={raw}
      title={t("common:myList")}
      kicker={t("watchlist:kicker")}
      icon="bookmark"
      subtitle={hasContent ? summaryLine : ""}
      topInset={top}
      actions={hasContent && !selection.active ? (
        <>
          <ShareMyListButton kind="watchlist" />
          {data.length > 0 && (
            <QuickChip onPress={selection.enter}>
              <Feather name="check-square" size={14} color={colors.brand.light} />
              <QuickChipText>{t("common:select")}</QuickChipText>
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
          <CollectionControls
            filters={filters}
            assist={assist}
            name={t("common:myList")}
            lead={<StageBar stage={stage} onStageChange={page.setStage} counts={page.stageCounts} />}
            quick={
              <QuickChip onPress={() => page.setView(nextView)} label={t(nextView === "grid" ? "watchlist:viewGrid" : "watchlist:viewList")}>
                <Feather name={nextView === "grid" ? "grid" : "list"} size={16} color={colors.text.secondary} />
              </QuickChip>
            }
          />
        </View>
      )}
      {/* Pendant la frappe, les suggestions prennent la place de la collection ;
          la réserve empêche la liste raccourcie de redescendre sous la barre. */}
      {assist.open ? (
        <>
          <SearchAssistPane assist={assist} inline />
          <View style={{ height: windowH }} />
        </>
      ) : showResume ? (
        <ResumeRail items={page.resume} onPlay={play} pendingId={pendingId} />
      ) : null}
    </View>
  );

  const emptyBody = stage !== "all" && filters.filtered.length > 0 ? (
    <CollectionNarrowEmpty message={t(`watchlist:${STAGE_EMPTY[stage]}`)} actionLabel={t("watchlist:showAll")} onAction={() => page.setStage("all")} />
  ) : filters.state.search.length >= 2 ? (
    <ScopedSearchEmpty query={filters.state.search} onApply={filters.setInput} external={false} />
  ) : (
    <CatalogEmpty filtered onReset={() => { filters.reset(); filters.patch({ type: "all" }); }} />
  );

  const refresh = <RefreshControl refreshing={isRefetching} onRefresh={selection.active ? undefined : refetch} tintColor={colors.brand.violet} />;

  return (
    <SubtleBackground ambient>
      <View style={styles.container}>
        {!hasContent ? (
          // Chargement ou liste vide : dans un défilement, pour garder le
          // « tirer pour actualiser » — une liste vide se recharge comme une pleine.
          <ScrollView
            contentContainerStyle={[styles.content, { paddingTop: top }]}
            refreshControl={isLoading ? undefined : refresh}
            showsVerticalScrollIndicator={false}
          >
            {hero}
            {isLoading ? skeleton : <WatchlistEmptyState />}
          </ScrollView>
        ) : (
          <FlatList
            ref={listRef}
            key={`watchlist-${cols}`}
            data={assist.open ? NONE : data}
            numColumns={cols}
            keyExtractor={(item) => item.Id}
            renderItem={renderItem}
            ListHeaderComponent={header}
            ListEmptyComponent={assist.open ? null : emptyBody}
            contentContainerStyle={[styles.content, { paddingTop: top }, selection.active && { paddingBottom: spacing.xxxl + 100 }]}
            columnWrapperStyle={cols > 1 ? { gap: gutter, paddingHorizontal: padding } : undefined}
            ItemSeparatorComponent={isList ? RowGap : undefined}
            keyboardShouldPersistTaps="handled"
            refreshControl={refresh}
            showsVerticalScrollIndicator={false}
          />
        )}

        <FloatingBackButton top={top} onPress={() => backOrHome(router)} />
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

const makeStyles = () =>
  StyleSheet.create({
    container: { flex: 1 },
    skeletonGrid: { flexDirection: "row", flexWrap: "wrap" },
    content: { paddingBottom: spacing.xxxl + 60 },
    rowWrap: { paddingHorizontal: spacing.screenPadding },
  });
