import { useState, useEffect, useMemo, useCallback, memo } from "react";
import {
  View, Text, TextInput, FlatList, Dimensions,
  ActivityIndicator, Pressable, StyleSheet,
} from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLibraryItems, useJellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { colors, spacing, typography } from "../theme";
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

function getNumColumns(): number {
  const { width } = Dimensions.get("window");
  return width >= 768 ? 3 : 2;
}

export function LibraryScreen({ libraryId, libraryName }: Props) {
  const { t } = useTranslation("common");
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const client = useJellyfinClient();

  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [activeSort, setActiveSort] = useState(0);
  const [numColumns, setNumColumns] = useState(getNumColumns);

  // Recalcul des colonnes au changement d'orientation
  useEffect(() => {
    const sub = Dimensions.addEventListener("change", () => {
      setNumColumns(getNumColumns());
    });
    return () => sub.remove();
  }, []);

  // Debounce de la recherche (300ms)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const sort = SORT_OPTIONS[activeSort];
  const { data, isLoading, refetch, isRefetching } = useLibraryItems(libraryId, {
    search: debounced,
    sortBy: sort.sortBy,
    sortOrder: sort.sortOrder,
    limit: 100,
  });

  const handlePress = useCallback(
    (item: MediaItem) => router.push(`/media/${item.Id}`),
    [router],
  );

  const renderItem = useCallback(
    ({ item }: { item: MediaItem }) => (
      <LibraryItemCard
        item={item}
        numColumns={numColumns}
        client={client}
        onPress={() => handlePress(item)}
      />
    ),
    [numColumns, client, handlePress],
  );

  const keyExtractor = useCallback((item: MediaItem) => item.Id, []);

  // Grille de squelettes pendant le chargement
  const skeletons = useMemo(() => {
    const screenW = Dimensions.get("window").width - spacing.screenPadding * 2;
    const cardW = (screenW - ITEM_GAP * (numColumns - 1)) / numColumns;
    const cardH = cardW / POSTER_ASPECT;
    return Array.from({ length: numColumns * 3 }).map((_, i) => (
      <View key={i} style={{ width: cardW, marginBottom: ITEM_GAP }}>
        <SkeletonCard width={cardW} height={cardH} />
      </View>
    ));
  }, [numColumns]);

  const itemCount = data?.length ?? 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* En-tête avec bouton retour */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
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
          placeholderTextColor={colors.textDim}
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
      ) : !data || data.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>{t("noResults")}</Text>
        </View>
      ) : (
        <FadeIn delay={100} style={{ flex: 1 }}>
          <FlatList
            key={`grid-${numColumns}`}
            data={data}
            numColumns={numColumns}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            contentContainerStyle={styles.gridContent}
            columnWrapperStyle={{ gap: ITEM_GAP }}
            onRefresh={refetch}
            refreshing={isRefetching}
            showsVerticalScrollIndicator={false}
            ListFooterComponent={
              <Text style={styles.footerCount}>
                {t("itemCount", { count: itemCount })}
              </Text>
            }
          />
        </FadeIn>
      )}

      {isRefetching && (
        <ActivityIndicator size="small" color={colors.accent} style={styles.refreshIndicator} />
      )}
    </View>
  );
}

/* ── Carte individuelle (mémoïsée) ─────────────────────── */

interface CardProps {
  item: MediaItem;
  numColumns: number;
  client: ReturnType<typeof useJellyfinClient>;
  onPress: () => void;
}

const LibraryItemCard = memo(function LibraryItemCard({ item, numColumns, client, onPress }: CardProps) {
  const screenW = Dimensions.get("window").width - spacing.screenPadding * 2;
  const cardW = (screenW - ITEM_GAP * (numColumns - 1)) / numColumns;
  const poster = client.getImageUrl(item.Id, "Primary", { width: 300, quality: 80 });
  const year = item.ProductionYear;
  const progress = item.UserData?.PlayedPercentage;

  return (
    <PressableCard onPress={onPress} style={{ width: cardW, marginBottom: spacing.md }}>
      <View style={{ aspectRatio: POSTER_ASPECT, borderRadius: spacing.cardRadius, overflow: "hidden", backgroundColor: colors.surfaceElevated }}>
        <Image source={{ uri: poster }} style={StyleSheet.absoluteFill} contentFit="cover" />
        {progress != null && progress > 0 && (
          <View style={styles.progressContainer}>
            <ProgressBar progress={progress / 100} height={3} />
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: spacing.md,
  },
  backButton: { marginRight: spacing.sm },
  backArrow: { color: colors.accent, fontSize: 32, lineHeight: 32, fontWeight: "300" },
  headerTitle: { color: colors.textPrimary, flex: 1 },
  searchContainer: { paddingHorizontal: spacing.screenPadding, marginBottom: spacing.md },
  searchInput: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: colors.surfaceElevated,
    borderRadius: spacing.cardRadius,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    color: colors.textPrimary,
    ...typography.body,
  },
  sortRow: {
    flexDirection: "row",
    paddingHorizontal: spacing.screenPadding,
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  sortChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: 20,
    backgroundColor: colors.surfaceElevated,
  },
  sortChipActive: { backgroundColor: colors.accent },
  sortChipText: { ...typography.caption, color: colors.textSecondary },
  sortChipTextActive: { color: colors.textPrimary, fontWeight: "600" },
  skeletonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: spacing.screenPadding,
    gap: ITEM_GAP,
  },
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyText: { ...typography.body, color: colors.textMuted },
  gridContent: { paddingHorizontal: spacing.screenPadding, paddingBottom: spacing.xxl },
  progressContainer: { position: "absolute", bottom: 0, left: 0, right: 0 },
  itemTitle: { color: colors.textPrimary, fontWeight: "600", marginTop: spacing.xs + 2 },
  itemYear: { color: colors.textMuted },
  footerCount: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: "center",
    paddingVertical: spacing.lg,
  },
  refreshIndicator: { position: "absolute", top: 100, alignSelf: "center" },
});
