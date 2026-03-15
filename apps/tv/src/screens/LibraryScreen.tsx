import { useCallback, useMemo, useState, useRef, useEffect } from "react";
import { View, ScrollView, Text, TVFocusGuideView, ActivityIndicator, findNodeHandle } from "react-native";
import { FlashList } from "@shopify/flash-list";
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
const ROW_GAP = 16;
const ESTIMATED_ITEM_SIZE = 290;

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
      genresList={genresList} onGoBack={() => navigation.goBack()}
      onSortChange={handleSortChange} onGenreChange={handleGenreChange} t={t}
    />
  ), [libraryName, sortIndex, selectedGenre, genresList, navigation, handleSortChange, handleGenreChange, t]);

  const renderItem = useCallback(({ item, index }: { item: MediaItem; index: number }) => (
    <GridItem
      item={item}
      index={index}
      totalItems={items.length}
      onPress={() => navigateToDetail(item)}
      onFocus={() => scrollToRow(Math.floor(index / COLUMNS))}
    />
  ), [navigateToDetail, scrollToRow, items.length]);

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
    <View style={{ width: CARD_W, marginBottom: ROW_GAP }}>
      <Focusable
        ref={ref}
        variant="card"
        onPress={onPress}
        onFocus={onFocus}
        hasTVPreferredFocus={index === 0}
        focusRadius={8}
        nextFocusLeft={isFirstInRow ? nodeId : undefined}
        nextFocusRight={isLastInRow ? nodeId : undefined}
      >
        <TVMediaCard item={item} variant="portrait" />
      </Focusable>
    </View>
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
