import { useCallback, useMemo, useState, useRef, useEffect } from "react";
import { View, ScrollView, Text, TVFocusGuideView, ActivityIndicator, findNodeHandle } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useLibraryCatalog, useGenres } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { useTranslation } from "react-i18next";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { TVPosterCard } from "../components/cards/TVPosterCard";
import { Focusable } from "../components/focus/Focusable";
import { Skeleton } from "../components/SkeletonLoader";
import { useTVRemote } from "../components/focus/useTVRemote";
import { TVShell } from "../components/nav/TVShell";
import { Colors, Spacing, Typography, Radius, CardConfig } from "../theme/colors";

type Props = NativeStackScreenProps<RootStackParamList, "Library">;

const COLUMNS = 5;
const ROW_GAP = 24;
// Grille adaptative : la largeur de carte est CALCULÉE depuis l'espace réel
// (écran − rail − padding), sinon 5 × 180 dp déborde en 960 dp (1080p) →
// cartes collées/rognées sans aucun espacement.
const WINDOW_W = require("react-native").Dimensions.get("window").width as number;
const RAIL_W = 76; // RAIL_COLLAPSED (TVShell réserve cette marge)
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
  const { t } = useTranslation("common");
  const flashListRef = useRef<FlashList<MediaItem>>(null);

  const [sortIndex, setSortIndex] = useState(0);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const currentSort = SORT_OPTIONS[sortIndex];

  const { data: genresList } = useGenres(libraryId);
  const { data, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } = useLibraryCatalog(libraryId, {
    sortBy: currentSort.sortBy,
    sortOrder: currentSort.sortOrder,
    genreIds: selectedGenre ? [selectedGenre] : undefined,
    limit: 30,
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
    flashListRef.current?.scrollToIndex({ index: rowIndex * COLUMNS, animated: false, viewPosition: 0.3 });
  }, []);

  const resetScroll = useCallback(() => {
    lastScrolledRow.current = -1;
    flashListRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, []);

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
      libraryName={libraryName} sortIndex={sortIndex} selectedGenre={selectedGenre}
      genresList={genresList}
      onSortChange={handleSortChange} onGenreChange={handleGenreChange} t={t}
    />
  ), [libraryName, sortIndex, selectedGenre, genresList, handleSortChange, handleGenreChange, t]);

  const renderItem = useCallback(({ item, index }: { item: MediaItem; index: number }) => (
    <GridItem
      item={item}
      index={index}
      totalItems={items.length}
      onPress={() => navigateToDetail(item)}
      onFocus={() => scrollToRow(Math.floor(index / COLUMNS))}
    />
  ), [navigateToDetail, scrollToRow, items.length]);

  const shellRoute = `Library_${libraryId}`;

  if (isLoading && items.length === 0) {
    return (
      <TVShell currentRoute={shellRoute}>
        <View style={{ flex: 1, backgroundColor: Colors.bgDeep, padding: Spacing.screenPadding }}>
          {header}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} width={CARD_W} height={CARD_H} />
            ))}
          </View>
        </View>
      </TVShell>
    );
  }

  if (!isLoading && items.length === 0) {
    return (
      <TVShell currentRoute={shellRoute}>
        <View style={{ flex: 1, backgroundColor: Colors.bgDeep, padding: Spacing.screenPadding }}>
          {header}
          <View style={{ alignItems: "center", paddingTop: 80 }}>
            <Text style={{ color: Colors.textTertiary, ...Typography.sectionTitle }}>
              {t("noResults", { defaultValue: "No items found" })}
            </Text>
          </View>
        </View>
      </TVShell>
    );
  }

  return (
    <TVShell currentRoute={shellRoute}>
      {/* @ts-ignore — TVFocusGuideView props from react-native-tvos */}
      <TVFocusGuideView style={{ flex: 1, backgroundColor: Colors.bgDeep }}>
        <FlashList
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
    </TVShell>
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

function GridItem({ item, index, totalItems, onPress, onFocus }: {
  item: MediaItem; index: number; totalItems: number;
  onPress: () => void; onFocus: () => void;
}) {
  const ref = useRef<View>(null);
  const [nodeId, setNodeId] = useState<number | undefined>(undefined);

  useEffect(() => {
    const handle = findNodeHandle(ref.current);
    if (handle) setNodeId(handle);
  }, []);

  const isFirstInRow = index % COLUMNS === 0;
  const isLastInRow = index % COLUMNS === COLUMNS - 1 || index === totalItems - 1;

  return (
    <View style={{ width: CELL_W, marginBottom: ROW_GAP }}>
      <Focusable
        ref={ref}
        variant="card"
        onPress={onPress}
        onFocus={onFocus}
        hasTVPreferredFocus={index === 0}
        focusRadius={8}
        scaleOverride={1.03}
        nextFocusRight={isLastInRow ? nodeId : undefined}
      >
        <TVPosterCard item={item} width={CARD_W} />
      </Focusable>
    </View>
  );
}

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
