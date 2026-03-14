import { useCallback, useMemo, useState, useRef } from "react";
import { View, FlatList, ScrollView, Text, TVFocusGuideView } from "react-native";
import { useLibraryCatalog, useGenres } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { useTranslation } from "react-i18next";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { TVMediaCard } from "../components/TVMediaCard";
import { Focusable } from "../components/focus/Focusable";
import { Skeleton } from "../components/SkeletonLoader";
import { useTVRemote } from "../components/focus/useTVRemote";
import { Colors, Spacing, Typography, Radius, CardConfig } from "../theme/colors";

type Props = NativeStackScreenProps<RootStackParamList, "Library">;

const COLUMNS = 5;
const CARD_W = CardConfig.portrait.width;
const CARD_H = CARD_W / CardConfig.portrait.aspectRatio;
const COL_GAP = 16;
const ROW_GAP = 16;

const SORT_OPTIONS = [
  { sortBy: "DateCreated", sortOrder: "Descending", labelKey: "sortDateDesc" },
  { sortBy: "SortName", sortOrder: "Ascending", labelKey: "sortTitleAsc" },
  { sortBy: "SortName", sortOrder: "Descending", labelKey: "sortTitleDesc" },
  { sortBy: "ProductionYear", sortOrder: "Descending", labelKey: "sortYearDesc" },
  { sortBy: "CommunityRating", sortOrder: "Descending", labelKey: "sortRatingDesc" },
] as const;

function chunkRows(items: MediaItem[]): MediaItem[][] {
  const rows: MediaItem[][] = [];
  for (let i = 0; i < items.length; i += COLUMNS) {
    rows.push(items.slice(i, i + COLUMNS));
  }
  return rows;
}

export function LibraryScreen({ route, navigation }: Props) {
  const { libraryId, libraryName } = route.params;
  const { t } = useTranslation("common");
  const flatListRef = useRef<FlatList>(null);

  // Measure real row height from first rendered row (includes title, metadata, padding)
  const measuredRowHeight = useRef(0);
  const [rowHeightReady, setRowHeightReady] = useState(false);

  const [sortIndex, setSortIndex] = useState(0);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const currentSort = SORT_OPTIONS[sortIndex];

  const { data: genresList } = useGenres(libraryId);
  const { data, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } = useLibraryCatalog(libraryId, {
    sortBy: currentSort.sortBy,
    sortOrder: currentSort.sortOrder,
    genreIds: selectedGenre ? [selectedGenre] : undefined,
    limit: 50,
  });

  const items = useMemo(() => data?.pages.flatMap((p) => p.Items) ?? [], [data]);
  const rows = useMemo(() => chunkRows(items), [items]);

  useTVRemote({ onBack: () => navigation.goBack() });

  const navigateToDetail = useCallback((item: MediaItem) => {
    navigation.navigate("MediaDetail", { itemId: item.Id });
  }, [navigation]);

  const resetScroll = useCallback(() => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
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

  // scrollToIndex with getItemLayout = instant (no async measure needed)
  const scrollToRow = useCallback((rowIndex: number) => {
    if (!measuredRowHeight.current) return;
    flatListRef.current?.scrollToIndex({ index: rowIndex, viewPosition: 0.3, animated: false });
  }, []);
  const scrollToRowRef = useRef(scrollToRow);
  scrollToRowRef.current = scrollToRow;

  // getItemLayout uses the REAL measured height — instant & accurate
  const getItemLayout = useCallback((_: unknown, index: number) => ({
    length: measuredRowHeight.current,
    offset: index * measuredRowHeight.current,
    index,
  }), []);

  const handleRowLayout = useCallback((height: number) => {
    if (measuredRowHeight.current === 0 && height > 0) {
      measuredRowHeight.current = height;
      setRowHeightReady(true);
    }
  }, []);

  const header = useMemo(() => (
    <LibraryHeader
      libraryName={libraryName} sortIndex={sortIndex} selectedGenre={selectedGenre}
      genresList={genresList} onGoBack={() => navigation.goBack()}
      onSortChange={handleSortChange} onGenreChange={handleGenreChange} t={t}
    />
  ), [libraryName, sortIndex, selectedGenre, genresList, navigation, handleSortChange, handleGenreChange, t]);

  const renderRow = useCallback(({ item: row, index: rowIndex }: { item: MediaItem[]; index: number }) => (
    <View
      style={{ flexDirection: "row", gap: COL_GAP, marginBottom: ROW_GAP }}
      onLayout={measuredRowHeight.current === 0
        ? (e) => handleRowLayout(e.nativeEvent.layout.height + ROW_GAP)
        : undefined}
    >
      {row.map((item, colIndex) => (
        <View key={item.Id} style={{ width: CARD_W }}>
          <Focusable
            variant="card"
            onPress={() => navigateToDetail(item)}
            onFocus={() => scrollToRowRef.current(rowIndex)}
            focusRadius={8}
            hasTVPreferredFocus={rowIndex === 0 && colIndex === 0}
          >
            <TVMediaCard item={item} variant="portrait" />
          </Focusable>
        </View>
      ))}
    </View>
  ), [navigateToDetail, handleRowLayout]);

  if (isLoading && items.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.bgDeep, padding: Spacing.screenPadding }}>
        {header}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} width={CARD_W} height={CARD_H} />
          ))}
        </View>
      </View>
    );
  }

  if (!isLoading && items.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.bgDeep, padding: Spacing.screenPadding }}>
        {header}
        <View style={{ alignItems: "center", paddingTop: 80 }}>
          <Text style={{ color: Colors.textTertiary, ...Typography.sectionTitle }}>
            {t("noResults", { defaultValue: "No items found" })}
          </Text>
        </View>
      </View>
    );
  }

  return (
    // @ts-ignore — TVFocusGuideView props from react-native-tvos
    <TVFocusGuideView trapFocusLeft style={{ flex: 1, backgroundColor: Colors.bgDeep }}>
      <FlatList
        ref={flatListRef}
        data={rows}
        keyExtractor={(row) => row[0].Id}
        renderItem={renderRow}
        {...(rowHeightReady ? { getItemLayout } : {})}
        ListHeaderComponent={header}
        contentContainerStyle={{ padding: Spacing.screenPadding, paddingBottom: 80 }}
        overScrollMode="never"
        initialNumToRender={4}
        windowSize={9}
        maxToRenderPerBatch={6}
        updateCellsBatchingPeriod={30}
        onEndReached={handleEndReached}
        onEndReachedThreshold={2}
      />
    </TVFocusGuideView>
  );
}

/* ---- Header sub-component ---- */

function LibraryHeader({ libraryName, sortIndex, selectedGenre, genresList,
  onGoBack, onSortChange, onGenreChange, t,
}: {
  libraryName: string; sortIndex: number; selectedGenre: string | null;
  genresList: Array<{ Id: string; Name: string }> | undefined;
  onGoBack: () => void; onSortChange: (index: number) => void;
  onGenreChange: (genreId: string | null) => void;
  t: (key: string, options?: Record<string, string>) => string;
}) {
  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 20 }}>
        <Focusable variant="button" onPress={onGoBack}>
          <View style={{
            paddingHorizontal: 20, paddingVertical: 10, borderRadius: Radius.small,
            backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: Colors.glassBorder,
          }}>
            <Text style={{ color: Colors.accentPurpleLight, ...Typography.buttonMedium }}>{t("back")}</Text>
          </View>
        </Focusable>
        <Text style={{ color: Colors.textPrimary, ...Typography.pageTitle, marginLeft: 20 }}>
          {libraryName}
        </Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={{ marginBottom: 12 }} contentContainerStyle={{ gap: 8 }}>
        {SORT_OPTIONS.map((opt, i) => {
          const active = i === sortIndex;
          return (
            <Focusable key={opt.labelKey} variant="button" onPress={() => onSortChange(i)}>
              <View style={{
                paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.pill,
                backgroundColor: active ? Colors.accentPurple : "rgba(255,255,255,0.06)",
                borderWidth: 1, borderColor: active ? Colors.accentPurple : Colors.glassBorder,
              }}>
                <Text style={{ color: active ? "#fff" : Colors.textSecondary, fontSize: 14, fontWeight: active ? "700" : "500" }}>
                  {t(opt.labelKey)}
                </Text>
              </View>
            </Focusable>
          );
        })}
      </ScrollView>
      {genresList && genresList.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          style={{ marginBottom: 20 }} contentContainerStyle={{ gap: 8 }}>
          <Focusable variant="button" onPress={() => onGenreChange(null)}>
            <View style={{
              paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.pill,
              backgroundColor: selectedGenre === null ? Colors.accentPurple : "rgba(255,255,255,0.06)",
              borderWidth: 1, borderColor: selectedGenre === null ? Colors.accentPurple : Colors.glassBorder,
            }}>
              <Text style={{ color: selectedGenre === null ? "#fff" : Colors.textSecondary, fontSize: 14, fontWeight: selectedGenre === null ? "700" : "500" }}>
                {t("allGenres")}
              </Text>
            </View>
          </Focusable>
          {genresList.map((genre) => {
            const active = selectedGenre === genre.Id;
            return (
              <Focusable key={genre.Id} variant="button" onPress={() => onGenreChange(genre.Id)}>
                <View style={{
                  paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.pill,
                  backgroundColor: active ? Colors.accentPurple : "rgba(255,255,255,0.06)",
                  borderWidth: 1, borderColor: active ? Colors.accentPurple : Colors.glassBorder,
                }}>
                  <Text style={{ color: active ? "#fff" : Colors.textSecondary, fontSize: 14, fontWeight: active ? "700" : "500" }}>
                    {genre.Name}
                  </Text>
                </View>
              </Focusable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}
