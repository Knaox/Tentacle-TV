import { useCallback, useMemo, useRef, useState } from "react";
import { View, ScrollView, Text, TVFocusGuideView } from "react-native";
import { useLibraryCatalog, useGenres } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { useTranslation } from "react-i18next";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { TVMediaCard } from "../components/TVMediaCard";
import { Focusable } from "../components/focus/Focusable";
import { Skeleton } from "../components/SkeletonLoader";
import { useTVRemote } from "../components/focus/useTVRemote";
import { useTVScrollToFocused } from "../hooks/useTVScrollToFocused";
import { Colors, Spacing, Typography, Radius, CardConfig } from "../theme/colors";

type Props = NativeStackScreenProps<RootStackParamList, "Library">;

const COLUMNS = 5;
const CARD_W = CardConfig.portrait.width;
const CARD_H = CARD_W / CardConfig.portrait.aspectRatio;
const ROW_GAP = 16;
const ROW_HEIGHT = CARD_H + ROW_GAP;

const SORT_OPTIONS = [
  { sortBy: "DateCreated", sortOrder: "Descending", labelKey: "sortDateDesc" },
  { sortBy: "SortName", sortOrder: "Ascending", labelKey: "sortTitleAsc" },
  { sortBy: "SortName", sortOrder: "Descending", labelKey: "sortTitleDesc" },
  { sortBy: "ProductionYear", sortOrder: "Descending", labelKey: "sortYearDesc" },
  { sortBy: "CommunityRating", sortOrder: "Descending", labelKey: "sortRatingDesc" },
] as const;

/** Threshold: trigger fetchNextPage when focusing items within the last N rows */
const PREFETCH_ROWS = 2;

export function LibraryScreen({ route, navigation }: Props) {
  const { libraryId, libraryName } = route.params;
  const { t } = useTranslation("common");
  const scrollRef = useRef<ScrollView>(null);
  const { makeOnFocus } = useTVScrollToFocused(scrollRef, 100);

  // Filter state
  const [sortIndex, setSortIndex] = useState(0);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);

  const currentSort = SORT_OPTIONS[sortIndex];

  // Data hooks
  const { data: genresList } = useGenres(libraryId);
  const { data, isLoading, hasNextPage, fetchNextPage } = useLibraryCatalog(libraryId, {
    sortBy: currentSort.sortBy,
    sortOrder: currentSort.sortOrder,
    genreIds: selectedGenre ? [selectedGenre] : undefined,
  });

  const items = useMemo(
    () => data?.pages.flatMap((p) => p.Items) ?? [],
    [data],
  );

  useTVRemote({ onBack: () => navigation.goBack() });

  const navigateToDetail = useCallback((item: MediaItem) => {
    navigation.navigate("MediaDetail", { itemId: item.Id });
  }, [navigation]);

  const resetScroll = useCallback(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, []);

  const handleSortChange = useCallback((index: number) => {
    setSortIndex(index);
    resetScroll();
  }, [resetScroll]);

  const handleGenreChange = useCallback((genreId: string | null) => {
    setSelectedGenre(genreId);
    resetScroll();
  }, [resetScroll]);

  /** onFocus for grid items: scroll to row + prefetch next page when near end */
  const handleItemFocus = useCallback((index: number) => {
    const rowIndex = Math.floor(index / COLUMNS);
    // Scroll: reuse makeOnFocus with row index (header offset handled by topOffset)
    makeOnFocus(rowIndex, ROW_HEIGHT)();

    // Prefetch: trigger when focusing items in the last PREFETCH_ROWS rows
    const totalRows = Math.ceil(items.length / COLUMNS);
    if (hasNextPage && rowIndex >= totalRows - PREFETCH_ROWS) {
      fetchNextPage();
    }
  }, [makeOnFocus, items.length, hasNextPage, fetchNextPage]);

  const header = (
    <View>
      {/* Title row */}
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 20 }}>
        <Focusable variant="button" onPress={() => navigation.goBack()}>
          <View style={{
            paddingHorizontal: 20, paddingVertical: 10,
            borderRadius: Radius.small,
            backgroundColor: "rgba(255,255,255,0.06)",
            borderWidth: 1, borderColor: Colors.glassBorder,
          }}>
            <Text style={{ color: Colors.accentPurpleLight, ...Typography.buttonMedium }}>
              {t("back")}
            </Text>
          </View>
        </Focusable>
        <Text style={{
          color: Colors.textPrimary, ...Typography.pageTitle,
          marginLeft: 20,
        }}>
          {libraryName}
        </Text>
      </View>

      {/* Sort pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginBottom: 12 }}
        contentContainerStyle={{ gap: 8 }}
      >
        {SORT_OPTIONS.map((opt, i) => {
          const active = i === sortIndex;
          return (
            <Focusable key={opt.labelKey} variant="button" onPress={() => handleSortChange(i)}>
              <View style={{
                paddingHorizontal: 16, paddingVertical: 8,
                borderRadius: Radius.pill,
                backgroundColor: active ? Colors.accentPurple : "rgba(255,255,255,0.06)",
                borderWidth: 1,
                borderColor: active ? Colors.accentPurple : Colors.glassBorder,
              }}>
                <Text style={{
                  color: active ? "#fff" : Colors.textSecondary,
                  fontSize: 14, fontWeight: active ? "700" : "500",
                }}>
                  {t(opt.labelKey)}
                </Text>
              </View>
            </Focusable>
          );
        })}
      </ScrollView>

      {/* Genre pills */}
      {genresList && genresList.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: 20 }}
          contentContainerStyle={{ gap: 8 }}
        >
          <Focusable variant="button" onPress={() => handleGenreChange(null)}>
            <View style={{
              paddingHorizontal: 16, paddingVertical: 8,
              borderRadius: Radius.pill,
              backgroundColor: selectedGenre === null ? Colors.accentPurple : "rgba(255,255,255,0.06)",
              borderWidth: 1,
              borderColor: selectedGenre === null ? Colors.accentPurple : Colors.glassBorder,
            }}>
              <Text style={{
                color: selectedGenre === null ? "#fff" : Colors.textSecondary,
                fontSize: 14, fontWeight: selectedGenre === null ? "700" : "500",
              }}>
                {t("allGenres")}
              </Text>
            </View>
          </Focusable>
          {genresList.map((genre) => {
            const active = selectedGenre === genre.Id;
            return (
              <Focusable key={genre.Id} variant="button" onPress={() => handleGenreChange(genre.Id)}>
                <View style={{
                  paddingHorizontal: 16, paddingVertical: 8,
                  borderRadius: Radius.pill,
                  backgroundColor: active ? Colors.accentPurple : "rgba(255,255,255,0.06)",
                  borderWidth: 1,
                  borderColor: active ? Colors.accentPurple : Colors.glassBorder,
                }}>
                  <Text style={{
                    color: active ? "#fff" : Colors.textSecondary,
                    fontSize: 14, fontWeight: active ? "700" : "500",
                  }}>
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
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ padding: Spacing.screenPadding, paddingBottom: 80 }}
        overScrollMode="never"
      >
        {header}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: ROW_GAP }}>
          {items.map((item, idx) => (
            <Focusable
              key={item.Id}
              variant="card"
              onPress={() => navigateToDetail(item)}
              onFocus={() => handleItemFocus(idx)}
              focusRadius={8}
              hasTVPreferredFocus={idx === 0}
            >
              <TVMediaCard item={item} variant="portrait" />
            </Focusable>
          ))}
        </View>
      </ScrollView>
    </TVFocusGuideView>
  );
}
