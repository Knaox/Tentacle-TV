import { memo, useCallback, useMemo, useRef, useState, type ReactElement, type Ref } from "react";
import { View, StyleSheet, useWindowDimensions, type FlatList } from "react-native";
import Animated, { runOnJS, useAnimatedScrollHandler, useComposedEventHandler, useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { UseInfiniteQueryResult } from "@tanstack/react-query";
import type { MediaItem } from "@tentacle-tv/shared";
import { BrandSpinner, FadeIn } from "@/components/ui";
import { ScrollTopFab } from "@/components/ui/ScrollTopFab";
import { MobileMediaCard } from "@/components/MobileMediaCard";
import { SeriesRatingScope } from "@/contexts/SeriesRatingContext";
import { motion, spacing, useGrid, useResponsive, useThemedStyles, type AppTheme } from "@/theme";
import { CatalogEmpty, CatalogGridSkeleton } from "./CatalogGridStates";

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
  /** Une recherche ou un filtre resserre la grille : l'état vide propose de les lever. */
  filtered?: boolean;
  /** Lever les filtres depuis l'état vide. */
  onReset?: () => void;
}

/**
 * La grille d'une bibliothèque : l'affiche de toutes les rangées
 * (`MobileMediaCard` — marqueurs, note, repli d'image, appui long vers la
 * feuille des cartes), en colonnes, chargée page à page. Le filtre « En
 * cours » y fait entrer des ÉPISODES : leur note, celle de leur série, se
 * résout pour toute la grille (`SeriesRatingScope`).
 */
export const CatalogGrid = memo(function CatalogGrid({
  catalog, onItemPress, overrideItems, header, empty, onScroll, topInset = 0, bottomInset = 0, listRef,
  filtered = false, onReset,
}: Props) {
  const styles = useThemedStyles(makeStyles);
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
      <View style={styles.cell}>
        <MobileMediaCard item={item} width={itemWidth} onPress={() => onItemPress(item)} />
      </View>
    ),
    [itemWidth, onItemPress, styles.cell],
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

  // Pendant le premier chargement, la grille montre sa propre silhouette
  // (même colonnes, même gouttière) ; ensuite, un état vide qui propose une
  // sortie quand un filtre en est la cause.
  const emptyComponent = useMemo(() => {
    if (empty !== undefined) return empty;
    if (catalog.isLoading) {
      return <CatalogGridSkeleton columns={numColumns} itemWidth={itemWidth} gutter={gutter} padding={padding} />;
    }
    return <CatalogEmpty filtered={filtered} onReset={onReset} />;
  }, [empty, catalog.isLoading, numColumns, itemWidth, gutter, padding, filtered, onReset]);

  return (
    <FadeIn delay={100} style={{ flex: 1 }}>
      <SeriesRatingScope items={items}>
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
      </SeriesRatingScope>
      <ScrollTopFab shown={shown} active={topActive} bottom={fabBottom} onPress={scrollTop} />
    </FadeIn>
  );
});

const makeStyles = (_t: AppTheme) => StyleSheet.create({
  gridContent: { paddingBottom: spacing.xxl },
  loader: { paddingVertical: spacing.xl },
  cell: { marginBottom: spacing.md },
});
