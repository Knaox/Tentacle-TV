import { useCallback, useState, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { backOrHome } from "@/utils/backOrHome";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import { cardRatingFor } from "@tentacle-tv/shared";
import type { MediaItem } from "@tentacle-tv/shared";
import { FadeIn, SkeletonCard, SubtleBackground } from "@/components/ui";
import { MediaActionSheet } from "@/components/MediaActionSheet";
import { SelectionBar } from "@/components/SelectionBar";
import { ListHeader } from "@/components/watchlist/ListHeader";
import { SelectableGridCard } from "@/components/watchlist/SelectableGridCard";
import { useMultiSelect } from "@/hooks/useMultiSelect";
import { CollectionFilterHeader } from "@/components/collection/CollectionFilterHeader";
import { useCollectionFilters } from "./useCollectionFilters";
import {
  spacing,
  typography,
  FONT_FAMILY,
  useGrid,
  useTheme,
  useThemedStyles,
  type AppTheme,
} from "@/theme";

const POSTER_ASPECT = 2 / 3;
const ITEM_GAP = spacing.sm;

export interface CollectionScreenProps {
  /** La source : `useWatchlistAll` ou `useFavoritesAll`, déjà appelée. */
  query: {
    data: MediaItem[] | undefined;
    isLoading: boolean;
    refetch: () => void;
    isRefetching: boolean;
  };
  /** Suppression en lot, déjà appelée par l'écran appelant. */
  batchRemove: { mutateAsync: (ids: string[]) => Promise<unknown> };
  title: string;
  titleIcon: "bookmark" | "heart";
  emptyTitle: string;
  emptyHint: string;
  /** Bouton propre à la page — le partage de Ma liste. */
  action?: React.ReactNode;
}

/**
 * Ma liste et Mes favoris — UN seul écran.
 *
 * Les deux étaient des copies l'une de l'autre à quatre points près : la
 * source, l'icône, deux libellés et un bouton de partage. Leur ajouter la
 * recherche, les filtres et le tri les aurait poussés tous deux au-delà de la
 * limite de trois cents lignes, et surtout : deux fois le même travail, avec la
 * certitude qu'ils finiraient par diverger.
 *
 * Le moteur de filtre est celui du bureau (`filterCollection`), au mot près.
 */
export function CollectionScreen({
  query, batchRemove, title, titleIcon, emptyTitle, emptyHint, action,
}: CollectionScreenProps) {
  const { t } = useTranslation("common");
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const client = useJellyfinClient();
  const { data: brut, isLoading, refetch, isRefetching } = query;
  const filters = useCollectionFilters(brut);
  const data = filters.filtered;
  const [longPressItemId, setLongPressItemId] = useState<string | null>(null);
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const selection = useMultiSelect<string>();
  const { numColumns, itemWidth: cardWidth, gutter, padding } = useGrid({ phoneColumns: 3 });

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

  // « Tout sélectionner » porte sur ce qui est FILTRÉ, jamais sur la liste
  // entière : c'est ce que l'écran montre.
  const handleSelectAll = useCallback(() => {
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
        rating={cardRatingFor(item, "series").rating}
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

  const count = data.length;
  const totalBrut = brut?.length ?? 0;
  const subtitle = isLoading
    ? ""
    : count === 0
    ? emptyHint
    : t("itemCount", { count, defaultValue: `${count} ${count === 1 ? "titre" : "titres"}` });

  return (
    <SubtleBackground ambient>
      <View style={[styles.container, { paddingTop: Math.max(insets.top, 24) }]}>
        <ListHeader
          title={title}
          subtitle={subtitle}
          titleIcon={titleIcon}
          onBack={() => backOrHome(router)}
          onEnterSelection={selection.enter}
          canSelect={count > 0 && !selection.active}
        />

        {!selection.active && action && <View style={styles.shareRow}>{action}</View>}

        {/* Filtres et recherche — masqués en sélection, où la barre du bas
            prend le relais, et sur une collection vraiment vide, où il n'y
            aurait rien à trier. */}
        {!selection.active && !isLoading && (brut?.length ?? 0) > 0 && (
          <CollectionFilterHeader filters={filters} />
        )}

        {isLoading ? (
          <View style={styles.skeletonGrid}>{skeletons}</View>
        ) : count === 0 ? (
          <ScrollView
            contentContainerStyle={{ paddingBottom: spacing.xxxl + 60 }}
            refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brand.violet} />}
            showsVerticalScrollIndicator={false}
          >
            {/* Une collection VIDE et une collection filtrée à zéro ne se
                disent pas pareil : la première invite à ajouter, la seconde
                propose de lever les filtres. */}
            <View style={styles.emptyContainer}>
              <Feather name={titleIcon} size={48} color={colors.brand.light} style={{ opacity: 0.6 }} />
              <Text style={styles.emptyTitle}>
                {totalBrut > 0 ? t("noResults") : emptyTitle}
              </Text>
              <Text style={styles.emptyHint}>
                {totalBrut > 0 ? t("noResultsHint") : emptyHint}
              </Text>
            </View>
          </ScrollView>
        ) : (
          <FadeIn delay={80} style={{ flex: 1 }}>
            <FlatList
              key={`collection-${numColumns}`}
              data={data}
              numColumns={numColumns}
              keyExtractor={keyExtractor}
              renderItem={renderItem}
              contentContainerStyle={[
                styles.gridContent,
                { paddingHorizontal: padding },
                selection.active && { paddingBottom: spacing.xxxl + 100 },
              ]}
              columnWrapperStyle={numColumns > 1 ? { gap: gutter } : undefined}
              refreshControl={
                <RefreshControl
                  refreshing={isRefetching}
                  onRefresh={selection.active ? undefined : refetch}
                  tintColor={colors.brand.violet}
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
            onClose={() => { setActionSheetVisible(false); setLongPressItemId(null); }}
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

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    container: { flex: 1 },
    shareRow: {
      flexDirection: "row",
      paddingHorizontal: spacing.screenPadding,
      paddingBottom: spacing.sm,
    },
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
      color: t.colors.text.primary,
      marginTop: spacing.md,
      letterSpacing: -0.3,
    },
    emptyHint: {
      ...typography.caption,
      fontFamily: FONT_FAMILY.regular,
      color: t.colors.text.tertiary,
      textAlign: "center",
      maxWidth: 280,
    },
  });
