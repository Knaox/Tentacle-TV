import { memo, useCallback, useMemo, useRef, useState, type ReactElement, type Ref } from "react";
import { View, Text, StyleSheet, useWindowDimensions, type FlatList } from "react-native";
import Animated, { runOnJS, useAnimatedScrollHandler, useComposedEventHandler, useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import type { UseInfiniteQueryResult } from "@tanstack/react-query";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import { cardRatingFor, type MediaItem } from "@tentacle-tv/shared";
import { BrandSpinner, PressableCard, ProgressBar, FadeIn } from "@/components/ui";
import { ScrollTopFab } from "@/components/ui/ScrollTopFab";
import { CardRatingBadge } from "@/components/cards/CardRatingBadge";
import { motion, spacing, typography, useGrid, useResponsive, useTheme, useThemedStyles, type AppTheme } from "@/theme";

const POSTER_ASPECT = 2 / 3;
/** En hauteurs d'écran : au-delà, le bouton « revenir en haut » se montre. */
const SCROLL_TOP_SCREENS = 1.5;

interface Props {
  catalog: UseInfiniteQueryResult<{ pages: Array<{ Items: MediaItem[]; TotalRecordCount: number }> }>;
  onItemPress: (item: MediaItem) => void;
  overrideItems?: MediaItem[];
  /** Ce qui défile AU-DESSUS de la grille, avec elle (l'onglet Bibliothèque). */
  header?: ReactElement | null;
  /** Remplace l'état vide — `null` : rien (la place est déjà prise). */
  empty?: ReactElement | null;
  /** Le repli du chrome (`useScrollChromeHandler`) : la grille défile SOUS l'en-tête flottant. */
  onScroll?: ReturnType<typeof import("@/components/navigation/scrollChrome").useScrollChromeHandler>;
  /** La hauteur de l'en-tête flottant, en marge du contenu. */
  topInset?: number;
  /** Ce que la barre d'onglets flottante couvre en bas : la fin de la liste doit la dépasser. */
  bottomInset?: number;
  listRef?: Ref<FlatList<MediaItem>>;
}

export const CatalogGrid = memo(function CatalogGrid({
  catalog, onItemPress, overrideItems, header, empty, onScroll, topInset = 0, bottomInset = 0, listRef,
}: Props) {
  const { t } = useTranslation("common");
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const client = useJellyfinClient();
  const { numColumns, itemWidth, gutter, padding } = useGrid({ phoneColumns: 3 });

  /* « Revenir en haut » : après un écran et demi de défilement, un bouton rond
   * au-dessus de la barre d'onglets. Le seuil se franchit sur le fil UI ; React
   * n'apprend que le franchissement (accessibilité, toucher). Le gestionnaire
   * se compose avec celui du repli du chrome, sans le remplacer. */
  const innerRef = useRef<FlatList<MediaItem> | null>(null);
  const setRefs = useCallback((node: FlatList<MediaItem> | null) => {
    innerRef.current = node;
    if (typeof listRef === "function") listRef(node);
    else if (listRef) (listRef as { current: FlatList<MediaItem> | null }).current = node;
  }, [listRef]);
  const { height: windowH } = useWindowDimensions();
  const threshold = windowH * SCROLL_TOP_SCREENS;
  const shown = useSharedValue(0);
  const [topActive, setTopActive] = useState(false);
  const topHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      const next = e.contentOffset.y > threshold ? 1 : 0;
      if (next !== shown.value) {
        shown.value = next;
        runOnJS(setTopActive)(next === 1);
      }
    },
  }, [threshold]);
  const composedScroll = useComposedEventHandler([onScroll ?? null, topHandler]);
  const scrollTop = useCallback(() => {
    innerRef.current?.scrollToOffset({ offset: 0, animated: !motion.isReducedMotion() });
  }, []);
  // Au-dessus de la barre flottante — sauf en rail (tablette paysage), où elle n'est pas en bas.
  const insets = useSafeAreaInsets();
  const { isTablet, isLandscape } = useResponsive();
  const fabBottom = (isTablet && isLandscape ? insets.bottom : Math.max(bottomInset, insets.bottom)) + 16;

  const items = useMemo(
    () => overrideItems ?? catalog.data?.pages.flatMap((p) => p.Items) ?? [],
    [overrideItems, catalog.data],
  );

  const renderItem = useCallback(
    ({ item }: { item: MediaItem }) => (
      <CatalogItemCard item={item} width={itemWidth} client={client} onPress={() => onItemPress(item)} />
    ),
    [itemWidth, client, onItemPress],
  );

  const keyExtractor = useCallback((item: MediaItem) => item.Id, []);

  const handleEndReached = useCallback(() => {
    if (catalog.hasNextPage && !catalog.isFetchingNextPage) {
      catalog.fetchNextPage();
    }
  }, [catalog]);

  const footer = useMemo(() => {
    if (catalog.isFetchingNextPage) {
      return <View style={styles.loader}><BrandSpinner size="small" /></View>;
    }
    return null;
  }, [catalog.isFetchingNextPage, styles]);

  const emptyComponent = useMemo(() => {
    if (empty !== undefined) return empty;
    if (catalog.isLoading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Feather name="inbox" size={48} color={colors.text.tertiary} />
        <Text style={styles.emptyTitle}>{t("noResults")}</Text>
        <Text style={styles.emptyHint}>{t("noResultsHint")}</Text>
      </View>
    );
  }, [empty, catalog.isLoading, t, colors, styles]);

  return (
    <FadeIn delay={100} style={{ flex: 1 }}>
      <Animated.FlatList
        ref={setRefs as never}
        key={`catalog-${numColumns}`}
        data={items}
        numColumns={numColumns}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        // La marge latérale va aux RANGÉES, pas au contenu : l'en-tête (l'ambiance
        // de l'onglet Bibliothèque) court d'un bord à l'autre. Une seule colonne
        // n'accepte pas `columnWrapperStyle` : la marge y reste au contenu.
        contentContainerStyle={[
          styles.gridContent,
          { paddingTop: topInset, paddingBottom: spacing.xxl + bottomInset },
          numColumns > 1 ? null : { paddingHorizontal: padding },
        ]}
        columnWrapperStyle={numColumns > 1 ? { gap: gutter, paddingHorizontal: padding } : undefined}
        ListHeaderComponent={header}
        onScroll={composedScroll}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        // Un champ dans l'en-tête (l'onglet Bibliothèque) : le clavier ne doit
        // jamais cacher le bas de ce qu'il fait apparaître (« Tous les résultats »).
        automaticallyAdjustKeyboardInsets
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        ListFooterComponent={footer}
        ListEmptyComponent={emptyComponent}
        onRefresh={catalog.refetch}
        refreshing={catalog.isRefetching && !catalog.isFetchingNextPage}
        showsVerticalScrollIndicator={false}
      />
      <ScrollTopFab shown={shown} active={topActive} bottom={fabBottom} onPress={scrollTop} />
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
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const isEpisode = item.Type === "Episode";
  const posterId = isEpisode && item.SeriesId ? item.SeriesId : item.Id;
  const poster = client.getImageUrl(posterId, "Primary", { width: 300, quality: 80 });
  const progress = item.UserData?.PlayedPercentage;
  const isWatched = item.UserData?.Played === true;
  // Portée `series` : cette grille montre l'affiche de la série pour un épisode
  // (cf. `posterId` ci-dessus). Le catalogue ne rend que des films et des
  // séries, donc rien à résoudre — aucune requête ici.
  const { rating } = cardRatingFor(item, "series");

  return (
    <PressableCard onPress={onPress} style={{ width, marginBottom: spacing.md }}>
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
        <CardRatingBadge rating={rating} />
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

const makeStyles = (t: AppTheme) => StyleSheet.create({
  gridContent: { paddingBottom: spacing.xxl },
  loader: { paddingVertical: spacing.xl },
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: spacing.xxxl * 2 },
  emptyTitle: { ...typography.subtitle, color: t.colors.text.tertiary, marginTop: spacing.md },
  emptyHint: { ...typography.caption, color: t.colors.text.quaternary, marginTop: spacing.xs },
  progressContainer: { position: "absolute", bottom: 0, left: 0, right: 0 },
  // R11 — Watched check unifié (web/mobile) : pastille contrastée + check + shadow.
  // Match desktop apps/web/src/components/cards/PosterCard.tsx:90.
  watchedBadge: {
    position: "absolute", top: 7, right: 7,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: t.colors.cta.primaryBg,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 4,
  },
  itemTitle: { ...typography.small, color: t.colors.text.primary, fontWeight: "600", marginTop: spacing.xs + 2 },
  itemYear: { ...typography.badge, color: t.colors.text.tertiary, marginTop: 2 },
});
