import { useCallback, useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  Dimensions,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import {
  useFavoritesAll,
  useJellyfinClient,
  useBatchRemoveFavorites,
} from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { FadeIn, SkeletonCard, SubtleBackground } from "@/components/ui";
import { MediaActionSheet } from "@/components/MediaActionSheet";
import { SelectionBar } from "@/components/SelectionBar";
import { ListHeader } from "@/components/watchlist/ListHeader";
import { SelectableGridCard } from "@/components/watchlist/SelectableGridCard";
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
 * Écran "Favoris" — pattern Tentacle cinematic identique à Watchlist :
 *  - SubtleBackground ambient violet
 *  - Header Inter ExtraBold avec icône heart et count subtitle
 *  - Grille 2:3 avec SelectableGridCard partagée
 *  - Empty state stylé (heart violet, baseline élégante)
 */
export function FavoritesScreen() {
  const { t } = useTranslation("common");
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const client = useJellyfinClient();
  const { data, isLoading, refetch, isRefetching } = useFavoritesAll();
  const [numColumns, setNumColumns] = useState(getNumColumns);
  const [longPressItemId, setLongPressItemId] = useState<string | null>(null);
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const selection = useMultiSelect<string>();
  const batchRemove = useBatchRemoveFavorites();

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

  const count = data?.length ?? 0;
  const subtitle = isLoading
    ? ""
    : count === 0
    ? t("emptyFavoritesHint")
    : t("itemCount", { count, defaultValue: `${count} ${count === 1 ? "titre" : "titres"}` });

  return (
    <SubtleBackground ambient>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ListHeader
          title={t("myFavorites")}
          subtitle={subtitle}
          titleIcon="heart"
          onBack={() => router.back()}
          onEnterSelection={selection.enter}
          canSelect={count > 0 && !selection.active}
        />

        {isLoading ? (
          <View style={styles.skeletonGrid}>{skeletons}</View>
        ) : count === 0 ? (
          <View style={styles.emptyContainer}>
            <Feather name="heart" size={48} color={BRAND.light} style={{ opacity: 0.6 }} />
            <Text style={styles.emptyTitle}>{t("emptyFavorites")}</Text>
            <Text style={styles.emptyHint}>{t("emptyFavoritesHint")}</Text>
          </View>
        ) : (
          <FadeIn delay={80} style={{ flex: 1 }}>
            <FlatList
              key={`favorites-${numColumns}`}
              data={data}
              numColumns={numColumns}
              keyExtractor={keyExtractor}
              renderItem={renderItem}
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
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
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
