import { useCallback, useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  Dimensions,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import {
  useWatchlistAll,
  useJellyfinClient,
  useMySharedWatchlists,
  useBatchRemoveWatchlist,
} from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { FadeIn, SkeletonCard, SubtleBackground } from "@/components/ui";
import { MediaActionSheet } from "@/components/MediaActionSheet";
import { SelectionBar } from "@/components/SelectionBar";
import { ListHeader } from "@/components/watchlist/ListHeader";
import { SelectableGridCard } from "@/components/watchlist/SelectableGridCard";
import { SharedListsSection } from "@/components/watchlist/SharedListsSection";
import { useMultiSelect } from "@/hooks/useMultiSelect";
import {
  colors,
  spacing,
  typography,
  BRAND,
  FONT_FAMILY,
} from "@/theme";

const POSTER_ASPECT = 2 / 3;
const ITEM_GAP = spacing.sm;

function getNumColumns(): number {
  return Dimensions.get("window").width >= 768 ? 4 : 3;
}

/**
 * Écran "Ma liste" (watchlist) — pattern Tentacle cinematic :
 *  - SubtleBackground ambient violet
 *  - Header Inter ExtraBold avec count subtitle + bouton sélection
 *  - Grille 2:3 stagger fadeIn, SelectableGridCard partagée
 *  - Footer section listes partagées (extraite)
 *  - Empty state stylé (icône violet, baseline élégante)
 */
export function WatchlistScreen() {
  const { t } = useTranslation("common");
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const client = useJellyfinClient();
  const { data, isLoading, refetch, isRefetching } = useWatchlistAll();
  const { data: sharedLists } = useMySharedWatchlists();
  const [numColumns, setNumColumns] = useState(getNumColumns);
  const [longPressItemId, setLongPressItemId] = useState<string | null>(null);
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const selection = useMultiSelect<string>();
  const batchRemove = useBatchRemoveWatchlist();

  useEffect(() => {
    const sub = Dimensions.addEventListener("change", () => setNumColumns(getNumColumns()));
    return () => sub.remove();
  }, []);

  const cardWidth = useMemo(() => {
    const screenW = Dimensions.get("window").width - spacing.screenPadding * 2;
    return (screenW - ITEM_GAP * (numColumns - 1)) / numColumns;
  }, [numColumns]);

  const handlePress = useCallback(
    (item: MediaItem) => {
      if (selection.active) selection.toggle(item.Id);
      else router.push(`/media/${item.Id}`);
    },
    [router, selection],
  );

  const handleLongPress = useCallback(
    (item: MediaItem) => {
      if (selection.active) return;
      setLongPressItemId(item.Id);
      setActionSheetVisible(true);
    },
    [selection.active],
  );

  const handleDelete = useCallback(async () => {
    const ids = Array.from(selection.selected);
    if (ids.length === 0) return;
    await batchRemove.mutateAsync(ids);
    selection.clear();
  }, [selection, batchRemove]);

  const handleSelectAll = useCallback(() => {
    if (!data) return;
    if (selection.count === data.length) selection.selectAll([]);
    else selection.selectAll(data.map((i) => i.Id));
  }, [data, selection]);

  const renderItem = useCallback(
    ({ item }: { item: MediaItem }) => (
      <SelectableGridCard
        posterUri={client.getImageUrl(item.Id, "Primary", { width: 300, quality: 80 })}
        title={item.Name}
        year={item.ProductionYear ?? null}
        progressPercent={item.UserData?.PlayedPercentage ?? null}
        watched={item.UserData?.Played === true}
        width={cardWidth}
        selectable={selection.active}
        selected={selection.selected.has(item.Id)}
        onPress={() => handlePress(item)}
        onLongPress={() => handleLongPress(item)}
      />
    ),
    [cardWidth, client, handlePress, handleLongPress, selection.active, selection.selected],
  );

  const keyExtractor = useCallback((item: MediaItem) => item.Id, []);

  const skeletons = useMemo(() => {
    const cardH = cardWidth / POSTER_ASPECT;
    return Array.from({ length: numColumns * 3 }).map((_, i) => (
      <View key={i} style={{ width: cardWidth, marginBottom: ITEM_GAP }}>
        <SkeletonCard width={cardWidth} height={cardH} />
      </View>
    ));
  }, [numColumns, cardWidth]);

  const sharedFooter = useMemo(
    () => (
      <SharedListsSection
        lists={sharedLists ?? []}
        onPressList={(id) => router.push(`/shared-watchlist/${id}`)}
      />
    ),
    [sharedLists, router],
  );

  const count = data?.length ?? 0;
  const subtitle = isLoading
    ? ""
    : count === 0
    ? t("emptyWatchlistHint")
    : t("itemCount", { count, defaultValue: `${count} ${count === 1 ? "titre" : "titres"}` });

  return (
    <SubtleBackground ambient>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ListHeader
          title={t("myList")}
          subtitle={subtitle}
          titleIcon="bookmark"
          onBack={() => router.back()}
          onEnterSelection={selection.enter}
          canSelect={count > 0 && !selection.active}
        />

        {isLoading ? (
          <View style={styles.skeletonGrid}>{skeletons}</View>
        ) : count === 0 ? (
          <ScrollView
            contentContainerStyle={{ paddingBottom: spacing.xxxl + 60 }}
            refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={BRAND.violet} />}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.emptyContainer}>
              <Feather name="bookmark" size={48} color={BRAND.light} style={{ opacity: 0.6 }} />
              <Text style={styles.emptyTitle}>{t("emptyWatchlist")}</Text>
              <Text style={styles.emptyHint}>{t("emptyWatchlistHint")}</Text>
            </View>
            {sharedFooter}
          </ScrollView>
        ) : (
          <FadeIn delay={80} style={{ flex: 1 }}>
            <FlatList
              key={`watchlist-${numColumns}`}
              data={data}
              numColumns={numColumns}
              keyExtractor={keyExtractor}
              renderItem={renderItem}
              ListFooterComponent={sharedFooter}
              contentContainerStyle={[
                styles.gridContent,
                selection.active && { paddingBottom: spacing.xxxl + 100 },
              ]}
              columnWrapperStyle={{ gap: ITEM_GAP }}
              refreshControl={
                <RefreshControl
                  refreshing={isRefetching}
                  onRefresh={selection.active ? undefined : refetch}
                  tintColor={BRAND.violet}
                />
              }
              showsVerticalScrollIndicator={false}
            />
          </FadeIn>
        )}

        {longPressItemId && (
          <MediaActionSheet
            visible={actionSheetVisible}
            itemId={longPressItemId}
            onClose={() => setActionSheetVisible(false)}
          />
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

const styles = StyleSheet.create({
  container: { flex: 1 },
  skeletonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: spacing.screenPadding,
    gap: ITEM_GAP,
  },
  gridContent: { paddingHorizontal: spacing.screenPadding, paddingBottom: spacing.xxxl + 60 },
  emptyContainer: {
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 80,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.screenPadding,
    gap: spacing.sm,
  },
  emptyTitle: {
    ...typography.subtitle,
    fontFamily: FONT_FAMILY.bold,
    fontSize: 18,
    color: colors.textPrimary,
    marginTop: spacing.md,
    letterSpacing: -0.3,
  },
  emptyHint: {
    ...typography.caption,
    fontFamily: FONT_FAMILY.regular,
    color: colors.textMuted,
    textAlign: "center",
    maxWidth: 280,
  },
});
