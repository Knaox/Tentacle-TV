import { useState, useEffect, useMemo, useCallback, memo } from "react";
import {
  View, Text, TextInput, FlatList,
  ActivityIndicator, Pressable, StyleSheet,
} from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { backOrHome } from "@/utils/backOrHome";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useLibraryCatalog, useJellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { spacing, typography, FONT_FAMILY, useGrid, useTheme, useThemedStyles, withAlpha, type AppTheme } from "../theme";
import { PressableCard, ProgressBar, SkeletonCard, FadeIn } from "../components/ui";

interface Props {
  libraryId: string;
  libraryName?: string;
}

type SortOption = { labelKey: string; sortBy: string; sortOrder: string };

const SORT_OPTIONS: SortOption[] = [
  { labelKey: "sortRecent", sortBy: "DateCreated", sortOrder: "Descending" },
  { labelKey: "sortAZ", sortBy: "SortName", sortOrder: "Ascending" },
  { labelKey: "sortYear", sortBy: "ProductionYear,SortName", sortOrder: "Descending" },
];

const POSTER_ASPECT = 2 / 3;
const ITEM_GAP = spacing.sm;

export function LibraryScreen({ libraryId, libraryName }: Props) {
  const { t } = useTranslation("common");
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const client = useJellyfinClient();

  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [activeSort, setActiveSort] = useState(0);
  const { numColumns, itemWidth, gutter, padding } = useGrid({ phoneColumns: 2 });

  // Debounce de la recherche (300ms)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const sort = SORT_OPTIONS[activeSort];
  const {
    data,
    isLoading,
    refetch,
    isRefetching,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useLibraryCatalog(libraryId, {
    searchTerm: debounced,
    sortBy: sort.sortBy,
    sortOrder: sort.sortOrder,
  });

  const items = useMemo(
    () => data?.pages.flatMap((p) => p.Items) ?? [],
    [data],
  );
  const totalCount = data?.pages[0]?.TotalRecordCount ?? 0;

  const handlePress = useCallback(
    (item: MediaItem) => router.push(`/media/${item.Id}`),
    [router],
  );

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const renderItem = useCallback(
    ({ item }: { item: MediaItem }) => (
      <LibraryItemCard
        item={item}
        width={itemWidth}
        client={client}
        onPress={() => handlePress(item)}
      />
    ),
    [itemWidth, client, handlePress],
  );

  const keyExtractor = useCallback((item: MediaItem) => item.Id, []);

  // Grille de squelettes pendant le chargement
  const skeletons = useMemo(() => {
    const cardH = itemWidth / POSTER_ASPECT;
    return Array.from({ length: numColumns * 3 }).map((_, i) => (
      <View key={i} style={{ width: itemWidth, marginBottom: ITEM_GAP }}>
        <SkeletonCard width={itemWidth} height={cardH} />
      </View>
    ));
  }, [numColumns, itemWidth]);

  const itemCount = totalCount;

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 24) }]}>
      {/* En-tête avec bouton retour */}
      <View style={styles.header}>
        <Pressable onPress={() => backOrHome(router)} hitSlop={12} style={styles.backButton}>
          <Text style={styles.backArrow}>{"‹"}</Text>
        </Pressable>
        <Text style={[typography.title, styles.headerTitle]} numberOfLines={1}>
          {libraryName ?? t("emptyLibrary")}
        </Text>
      </View>

      {/* Barre de recherche */}
      <View style={styles.searchContainer}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t("searchPlaceholder")}
          placeholderTextColor={colors.text.quaternary}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.searchInput}
        />
      </View>

      {/* Chips de tri */}
      <View style={styles.sortRow}>
        {SORT_OPTIONS.map((opt, idx) => (
          <Pressable
            key={opt.labelKey}
            onPress={() => setActiveSort(idx)}
            style={[styles.sortChip, idx === activeSort && styles.sortChipActive]}
          >
            <Text style={[styles.sortChipText, idx === activeSort && styles.sortChipTextActive]}>
              {t(opt.labelKey)}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Contenu principal */}
      {isLoading && !isRefetching ? (
        <View style={styles.skeletonGrid}>{skeletons}</View>
      ) : items.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>{t("noResults")}</Text>
        </View>
      ) : (
        <FadeIn delay={100} style={{ flex: 1 }}>
          <FlatList
            key={`grid-${numColumns}`}
            data={items}
            numColumns={numColumns}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            contentContainerStyle={[styles.gridContent, { paddingHorizontal: padding }]}
            columnWrapperStyle={numColumns > 1 ? { gap: gutter } : undefined}
            onRefresh={refetch}
            refreshing={isRefetching && !isFetchingNextPage}
            onEndReached={handleEndReached}
            onEndReachedThreshold={0.5}
            showsVerticalScrollIndicator={false}
            ListFooterComponent={
              isFetchingNextPage ? (
                <ActivityIndicator size="small" color={colors.brand.violet} style={{ paddingVertical: spacing.xl }} />
              ) : (
                <Text style={styles.footerCount}>
                  {t("itemCount", { count: itemCount })}
                </Text>
              )
            }
          />
        </FadeIn>
      )}

      {isRefetching && (
        <ActivityIndicator size="small" color={colors.brand.violet} style={styles.refreshIndicator} />
      )}
    </View>
  );
}

/* ── Carte individuelle (mémoïsée) ─────────────────────── */

interface CardProps {
  item: MediaItem;
  width: number;
  client: ReturnType<typeof useJellyfinClient>;
  onPress: () => void;
}

const LibraryItemCard = memo(function LibraryItemCard({ item, width, client, onPress }: CardProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const cardW = width;
  const poster = client.getImageUrl(item.Id, "Primary", { width: 300, quality: 80 });
  const year = item.ProductionYear;
  const progress = item.UserData?.PlayedPercentage;
  const isWatched = item.UserData?.Played === true;

  return (
    <PressableCard onPress={onPress} style={{ width: cardW, marginBottom: spacing.md }}>
      <View style={{ aspectRatio: POSTER_ASPECT, borderRadius: spacing.cardRadius, overflow: "hidden", backgroundColor: colors.surface.s2 }}>
        <Image source={{ uri: poster }} style={StyleSheet.absoluteFill} contentFit="cover" />
        {progress != null && progress > 0 && !isWatched && (
          <View style={styles.progressContainer}>
            <ProgressBar progress={progress / 100} height={3} />
          </View>
        )}
        {isWatched && (
          <View style={styles.watchedBadge}>
            <Feather name="check" size={12} color={colors.cta.primaryFg} />
          </View>
        )}
      </View>
      <Text numberOfLines={1} style={[typography.caption, styles.itemTitle]}>
        {item.Name}
      </Text>
      {year != null && (
        <Text style={[typography.small, styles.itemYear]}>{year}</Text>
      )}
    </PressableCard>
  );
});

/* ── Styles ──────────────────────────────────────────────── */

const makeStyles = (t: AppTheme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.colors.surface.s0 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: spacing.md,
  },
  backButton: { marginRight: spacing.sm },
  backArrow: { color: t.colors.brand.violet, fontSize: 32, lineHeight: 32, fontWeight: "300" },
  headerTitle: { color: t.colors.text.primary, flex: 1 },
  searchContainer: { paddingHorizontal: spacing.screenPadding, marginBottom: spacing.md },
  searchInput: {
    backgroundColor: t.colors.fill.subtle,
    borderWidth: 1,
    borderColor: t.colors.surface.s2,
    borderRadius: spacing.cardRadius,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    color: t.colors.text.primary,
    ...typography.body,
  },
  sortRow: { flexDirection: "row", paddingHorizontal: spacing.screenPadding, gap: spacing.sm, marginBottom: spacing.lg },
  sortChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2, borderRadius: 20, backgroundColor: t.colors.surface.s2 },
  sortChipActive: { backgroundColor: t.colors.brand.soft, borderWidth: 1, borderColor: withAlpha(t.colors.brand.violet, 0.45, t.colors.brand.glow) },
  sortChipText: { ...typography.caption, color: t.colors.text.tertiary, fontFamily: FONT_FAMILY.medium },
  sortChipTextActive: { color: t.colors.brand.light, fontFamily: FONT_FAMILY.semibold },
  skeletonGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: spacing.screenPadding, gap: ITEM_GAP },
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyText: { ...typography.body, color: t.colors.text.tertiary },
  gridContent: { paddingHorizontal: spacing.screenPadding, paddingBottom: spacing.xxl },
  progressContainer: { position: "absolute", bottom: 0, left: 0, right: 0 },
  // R11 — Watched check unifié (web/mobile) : pastille contrastée + check + shadow.
  // Match desktop apps/web/src/components/cards/PosterCard.tsx:90.
  watchedBadge: { position: "absolute", top: 7, right: 7, width: 22, height: 22, borderRadius: 11, backgroundColor: t.colors.cta.primaryBg, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.35, shadowRadius: 4, elevation: 4 },
  itemTitle: { color: t.colors.text.primary, fontWeight: "600", marginTop: spacing.xs + 2 },
  itemYear: { color: t.colors.text.tertiary },
  footerCount: { ...typography.caption, color: t.colors.text.tertiary, textAlign: "center", paddingVertical: spacing.lg },
  refreshIndicator: { position: "absolute", top: 100, alignSelf: "center" },
});
