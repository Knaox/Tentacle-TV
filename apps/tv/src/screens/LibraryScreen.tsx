import { useCallback, useMemo, useState, useRef, useEffect, memo } from "react";
import { View, ScrollView, Text, TVFocusGuideView, ActivityIndicator, findNodeHandle } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useLibraryCatalog, useGenres } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { useTranslation } from "react-i18next";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { TVPosterFrame, TVPosterMeta } from "../components/cards/TVPosterCard";
import { Focusable } from "../components/focus/Focusable";
import { Skeleton } from "../components/SkeletonLoader";
import { useTVRemote } from "../components/focus/useTVRemote";
import { TVScreenFrame } from "../components/nav/TVScreenFrame";
import { possessiveLibraryName } from "../utils/libraryLabel";
import { Colors, Spacing, Typography, Radius, CardConfig } from "../theme/colors";
import { RAIL_COLLAPSED } from "../components/nav/TVSideRail";

type Props = NativeStackScreenProps<RootStackParamList, "Library">;

const COLUMNS = 5;
const ROW_GAP = 24;
// Grille adaptative : la largeur de carte est CALCULÉE depuis l'espace réel
// (écran − rail − padding), sinon 5 × 180 dp déborde en 960 dp (1080p) →
// cartes collées/rognées sans aucun espacement.
const WINDOW_W = require("react-native").Dimensions.get("window").width as number;
// Reprise du rail, jamais recopiée : la valeur vivait ici en double et ne
// suivait pas quand le rail changeait de géométrie.
const RAIL_W = RAIL_COLLAPSED;
const GRID_AVAIL = WINDOW_W - RAIL_W - Spacing.screenPadding * 2;
const CELL_W = Math.floor(GRID_AVAIL / COLUMNS);
const CARD_W = CELL_W - Spacing.cardGap;
const CARD_H = Math.round(CARD_W / CardConfig.portrait.aspectRatio);
// Image 2:3 + titre + année + marges
const ESTIMATED_ITEM_SIZE = CARD_H + 56 + ROW_GAP;

const SORT_OPTIONS = [
  { sortBy: "DateCreated", sortOrder: "Descending", labelKey: "sortDateDesc" },
  { sortBy: "SortName", sortOrder: "Ascending", labelKey: "sortTitleAsc" },
  { sortBy: "SortName", sortOrder: "Descending", labelKey: "sortTitleDesc" },
  { sortBy: "ProductionYear", sortOrder: "Descending", labelKey: "sortYearDesc" },
  { sortBy: "CommunityRating", sortOrder: "Descending", labelKey: "sortRatingDesc" },
] as const;

export function LibraryScreen({ route, navigation }: Props) {
  const { libraryId, libraryName } = route.params;
  const { t, i18n } = useTranslation("common");
  const displayName = possessiveLibraryName(libraryName, i18n.language);
  const flashListRef = useRef<FlashList<MediaItem>>(null);

  const [sortIndex, setSortIndex] = useState(0);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const currentSort = SORT_OPTIONS[sortIndex];

  const { data: genresList } = useGenres(libraryId);
  // fields:"light" : payload minimum pour la grille (le prefetch du rail
  // utilise les MÊMES filtres — toute divergence = cache-miss)
  const { data, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } = useLibraryCatalog(libraryId, {
    sortBy: currentSort.sortBy,
    sortOrder: currentSort.sortOrder,
    genreIds: selectedGenre ? [selectedGenre] : undefined,
    limit: 30,
    fields: "light",
  });

  const items = useMemo(() => data?.pages.flatMap((p) => p.Items) ?? [], [data]);

  useTVRemote({ onBack: () => navigation.goBack() });

  const navigateToDetail = useCallback((item: MediaItem) => {
    navigation.navigate("MediaDetail", { itemId: item.Id });
  }, [navigation]);

  // Guard: only scroll when the focused row actually changes (prevents rollback on DPAD left/right)
  const lastScrolledRow = useRef(-1);
  const scrollToRow = useCallback((rowIndex: number) => {
    if (lastScrolledRow.current === rowIndex) return;
    lastScrolledRow.current = rowIndex;
    if (rowIndex === 0) {
      // 1ʳᵉ rangée : remonter à l'offset 0 pour garder le header (titre +
      // filtres) visible — scrollToIndex(0, viewPosition 0.3) le coupait.
      flashListRef.current?.scrollToOffset({ offset: 0, animated: false });
      return;
    }
    flashListRef.current?.scrollToIndex({ index: rowIndex * COLUMNS, animated: false, viewPosition: 0.3 });
  }, []);

  const resetScroll = useCallback(() => {
    lastScrolledRow.current = -1;
    flashListRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, []);

  // Changement de bibliothèque : l'écran est réutilisé par navigation.navigate
  // → repartir en haut avec les filtres par défaut, sinon le scroll/tri de la
  // bibliothèque précédente persiste et du contenu est manqué.
  useEffect(() => {
    setSortIndex(0);
    setSelectedGenre(null);
    resetScroll();
  }, [libraryId, resetScroll]);

  const handleSortChange = useCallback((index: number) => {
    setSortIndex(index);
    resetScroll();
  }, [resetScroll]);

  const handleGenreChange = useCallback((genreId: string | null) => {
    setSelectedGenre(genreId);
    resetScroll();
  }, [resetScroll]);

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const header = useMemo(() => (
    <LibraryHeader
      libraryName={displayName} sortIndex={sortIndex} selectedGenre={selectedGenre}
      genresList={genresList}
      onSortChange={handleSortChange} onGenreChange={handleGenreChange} t={t}
    />
  ), [displayName, sortIndex, selectedGenre, genresList, handleSortChange, handleGenreChange, t]);

  // totalItems via ref : chaque page chargée ne doit pas invalider renderItem
  // (sinon toute la grille re-rend à chaque pagination).
  const totalItemsRef = useRef(0);
  totalItemsRef.current = items.length;
  const isLastItem = useCallback((index: number) => index === totalItemsRef.current - 1, []);

  const renderItem = useCallback(({ item, index }: { item: MediaItem; index: number }) => (
    <GridItem
      item={item}
      index={index}
      isLastItem={isLastItem(index)}
      onPressItem={navigateToDetail}
      onFocusRow={scrollToRow}
    />
  ), [navigateToDetail, scrollToRow, isLastItem]);

  if (isLoading && items.length === 0) {
    return (
      <TVScreenFrame>
        <View style={{ flex: 1, backgroundColor: Colors.bgDeep, padding: Spacing.screenPadding }}>
          {header}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} width={CARD_W} height={CARD_H} />
            ))}
          </View>
        </View>
      </TVScreenFrame>
    );
  }

  if (!isLoading && items.length === 0) {
    return (
      <TVScreenFrame>
        <View style={{ flex: 1, backgroundColor: Colors.bgDeep, padding: Spacing.screenPadding }}>
          {header}
          <View style={{ alignItems: "center", paddingTop: 80 }}>
            <Text style={{ color: Colors.textTertiary, ...Typography.sectionTitle }}>
              {t("noResults", { defaultValue: "No items found" })}
            </Text>
          </View>
        </View>
      </TVScreenFrame>
    );
  }

  return (
    <TVScreenFrame>
      <TVFocusGuideView style={{ flex: 1, backgroundColor: Colors.bgDeep }}>
        <FlashList
          // Remonter la liste à CHAQUE changement de bibliothèque : sans `key`,
          // FlashList est réutilisée et conserve son contentOffset interne. Le
          // resetScroll() du useEffect court alors trop tôt (keepPreviousData
          // affiche encore l'ancienne biblio / relayout en cours) → offset
          // résiduel = page « légèrement défilée ». Un conteneur neuf repart à 0
          // (et item 0 reprend hasTVPreferredFocus). Le tri/genre ne changent
          // PAS la key → pas de remontage → pas de vol de focus sur les pills.
          key={libraryId}
          ref={flashListRef}
          data={items}
          numColumns={COLUMNS}
          estimatedItemSize={ESTIMATED_ITEM_SIZE}
          renderItem={renderItem}
          keyExtractor={(item) => item.Id}
          ListHeaderComponent={header}
          contentContainerStyle={{ padding: Spacing.screenPadding, paddingBottom: 80 }}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.5}
          drawDistance={800}
          overrideItemLayout={(layout) => { layout.size = ESTIMATED_ITEM_SIZE; }}
          ListFooterComponent={isFetchingNextPage ? <FooterLoader /> : null}
          overScrollMode="never"
        />
      </TVFocusGuideView>
    </TVScreenFrame>
  );
}

function FooterLoader() {
  return (
    <View style={{ paddingVertical: 24, alignItems: "center" }}>
      <ActivityIndicator size="small" color={Colors.accentPurple} />
    </View>
  );
}

/* ---- Grid item with edge focus clamping ---- */

// Mémoïsé : la grille FlashList re-rend au scroll/focus — seules les props
// stables (callbacks par référence) évitent un re-render O(n) de la grille.
const GridItem = memo(function GridItem({ item, index, isLastItem, onPressItem, onFocusRow }: {
  item: MediaItem; index: number; isLastItem: boolean;
  onPressItem: (item: MediaItem) => void; onFocusRow: (rowIndex: number) => void;
}) {
  const ref = useRef<View>(null);
  const [nodeId, setNodeId] = useState<number | undefined>(undefined);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    const handle = findNodeHandle(ref.current);
    if (handle) setNodeId(handle);
  }, []);

  const isLastInRow = index % COLUMNS === COLUMNS - 1 || isLastItem;

  return (
    <View style={{ width: CELL_W, marginBottom: ROW_GAP }}>
      {/* Le ring de focus n'entoure QUE l'affiche (comme le web) — les textes
          restent dessous, hors halo, sans déborder sur la rangée suivante. */}
      <Focusable
        ref={ref}
        variant="card"
        onPress={() => onPressItem(item)}
        onFocus={() => { setFocused(true); onFocusRow(Math.floor(index / COLUMNS)); }}
        onBlur={() => setFocused(false)}
        hasTVPreferredFocus={index === 0}
        focusRadius={8}
        scaleOverride={1.03}
        nextFocusRight={isLastInRow ? nodeId : undefined}
        style={{ alignSelf: "flex-start" }}
      >
        <TVPosterFrame item={item} width={CARD_W} focused={focused} />
      </Focusable>
      <TVPosterMeta item={item} width={CARD_W} />
    </View>
  );
});

/* ---- Header sub-component ---- */

function LibraryHeader({ libraryName, sortIndex, selectedGenre, genresList,
  onSortChange, onGenreChange, t,
}: {
  libraryName: string; sortIndex: number; selectedGenre: string | null;
  genresList: Array<{ Id: string; Name: string }> | undefined;
  onSortChange: (index: number) => void;
  onGenreChange: (genreId: string | null) => void;
  t: (key: string, options?: Record<string, string>) => string;
}) {
  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 20 }}>
        <Text style={{ color: Colors.textPrimary, ...Typography.pageTitle }}>
          {libraryName}
        </Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={{ marginBottom: 12 }} contentContainerStyle={{ gap: 8 }}>
        {SORT_OPTIONS.map((opt, i) => (
          <FilterPill key={opt.labelKey} label={t(opt.labelKey)} active={i === sortIndex} onPress={() => onSortChange(i)} />
        ))}
      </ScrollView>
      {genresList && genresList.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          style={{ marginBottom: 20 }} contentContainerStyle={{ gap: 8 }}>
          <FilterPill label={t("allGenres")} active={selectedGenre === null} onPress={() => onGenreChange(null)} />
          {genresList.map((genre) => (
            <FilterPill key={genre.Id} label={genre.Name} active={selectedGenre === genre.Id} onPress={() => onGenreChange(genre.Id)} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

/** Pill de filtre alignée sur les tokens web : actif = brand-soft + texte brand-light. */
function FilterPill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Focusable variant="button" focusRadius={Radius.pill} onPress={onPress}>
      <View style={{
        paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.pill,
        backgroundColor: active ? "rgba(139, 92, 246, 0.18)" : Colors.ctaGhostBg,
        borderWidth: 1,
        borderColor: active ? "rgba(139, 92, 246, 0.45)" : Colors.glassBorder,
      }}>
        <Text style={{
          color: active ? Colors.accentPurpleLight : Colors.textSecondary,
          ...(active ? Typography.buttonMedium : Typography.caption),
          fontSize: 14,
        }}>
          {label}
        </Text>
      </View>
    </Focusable>
  );
}
