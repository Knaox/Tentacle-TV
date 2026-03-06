import { memo, useCallback, useState, useEffect, useMemo } from "react";
import { View, Text, FlatList, Dimensions, ActivityIndicator, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import type { UseInfiniteQueryResult } from "@tanstack/react-query";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { PressableCard, ProgressBar, FadeIn } from "@/components/ui";
import { colors, spacing, typography } from "@/theme";

const POSTER_ASPECT = 2 / 3;
const ITEM_GAP = spacing.sm;

function getNumColumns(): number {
  return Dimensions.get("window").width >= 768 ? 4 : 3;
}

interface Props {
  catalog: UseInfiniteQueryResult<{ pages: Array<{ Items: MediaItem[]; TotalRecordCount: number }> }>;
  onItemPress: (item: MediaItem) => void;
}

export const CatalogGrid = memo(function CatalogGrid({ catalog, onItemPress }: Props) {
  const { t } = useTranslation("common");
  const client = useJellyfinClient();
  const [numColumns, setNumColumns] = useState(getNumColumns);

  useEffect(() => {
    const sub = Dimensions.addEventListener("change", () => setNumColumns(getNumColumns()));
    return () => sub.remove();
  }, []);

  const items = useMemo(
    () => catalog.data?.pages.flatMap((p) => p.Items) ?? [],
    [catalog.data],
  );

  const cardWidth = useMemo(() => {
    const screenW = Dimensions.get("window").width - spacing.screenPadding * 2;
    return (screenW - ITEM_GAP * (numColumns - 1)) / numColumns;
  }, [numColumns]);

  const renderItem = useCallback(
    ({ item }: { item: MediaItem }) => (
      <CatalogItemCard item={item} width={cardWidth} client={client} onPress={() => onItemPress(item)} />
    ),
    [cardWidth, client, onItemPress],
  );

  const keyExtractor = useCallback((item: MediaItem) => item.Id, []);

  const handleEndReached = useCallback(() => {
    if (catalog.hasNextPage && !catalog.isFetchingNextPage) {
      catalog.fetchNextPage();
    }
  }, [catalog]);

  const footer = useMemo(() => {
    if (catalog.isFetchingNextPage) {
      return <ActivityIndicator size="small" color={colors.accent} style={styles.loader} />;
    }
    return null;
  }, [catalog.isFetchingNextPage]);

  const emptyComponent = useMemo(() => {
    if (catalog.isLoading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Feather name="inbox" size={48} color={colors.textMuted} />
        <Text style={styles.emptyTitle}>{t("noResults")}</Text>
        <Text style={styles.emptyHint}>{t("noResultsHint")}</Text>
      </View>
    );
  }, [catalog.isLoading, t]);

  return (
    <FadeIn delay={100} style={{ flex: 1 }}>
      <FlatList
        key={`catalog-${numColumns}`}
        data={items}
        numColumns={numColumns}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={styles.gridContent}
        columnWrapperStyle={{ gap: ITEM_GAP }}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        ListFooterComponent={footer}
        ListEmptyComponent={emptyComponent}
        onRefresh={catalog.refetch}
        refreshing={catalog.isRefetching && !catalog.isFetchingNextPage}
        showsVerticalScrollIndicator={false}
      />
    </FadeIn>
  );
});

/* ── Carte catalogue (mémoïsée) ─────────────────────── */

interface CardProps {
  item: MediaItem;
  width: number;
  client: ReturnType<typeof useJellyfinClient>;
  onPress: () => void;
}

const CatalogItemCard = memo(function CatalogItemCard({ item, width, client, onPress }: CardProps) {
  const isEpisode = item.Type === "Episode";
  const posterId = isEpisode && item.SeriesId ? item.SeriesId : item.Id;
  const poster = client.getImageUrl(posterId, "Primary", { width: 300, quality: 80 });
  const progress = item.UserData?.PlayedPercentage;

  return (
    <PressableCard onPress={onPress} style={{ width, marginBottom: spacing.md }}>
      <View style={{ aspectRatio: POSTER_ASPECT, borderRadius: spacing.cardRadius, overflow: "hidden", backgroundColor: colors.surfaceElevated }}>
        <Image source={{ uri: poster }} style={StyleSheet.absoluteFill} contentFit="cover" />
        {progress != null && progress > 0 && (
          <View style={styles.progressContainer}>
            <ProgressBar progress={progress / 100} height={3} />
          </View>
        )}
      </View>
      <Text numberOfLines={1} style={styles.itemTitle}>
        {isEpisode && item.SeriesName ? item.SeriesName : item.Name}
      </Text>
      {item.ProductionYear != null && (
        <Text style={styles.itemYear}>{item.ProductionYear}</Text>
      )}
    </PressableCard>
  );
});

const styles = StyleSheet.create({
  gridContent: { paddingHorizontal: spacing.screenPadding, paddingBottom: spacing.xxl },
  loader: { paddingVertical: spacing.xl },
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: spacing.xxxl * 2 },
  emptyTitle: { ...typography.subtitle, color: colors.textMuted, marginTop: spacing.md },
  emptyHint: { ...typography.caption, color: colors.textDim, marginTop: spacing.xs },
  progressContainer: { position: "absolute", bottom: 0, left: 0, right: 0 },
  itemTitle: { ...typography.small, color: colors.textPrimary, fontWeight: "600", marginTop: spacing.xs + 2 },
  itemYear: { ...typography.badge, color: colors.textMuted, marginTop: 2 },
});
