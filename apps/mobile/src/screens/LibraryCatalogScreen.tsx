import { useState, useEffect, useCallback, useMemo } from "react";
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useLibraryCatalog } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { BottomSheet } from "@/components/ui";
import { GenreFilter, SortSelector, StatusFilter, CatalogGrid, SORT_OPTIONS, AdvancedFilterSheet } from "@/components/catalog";
import { usePlatformFilter } from "@/hooks/usePlatformFilter";
import type { AdvancedFilters } from "@/components/catalog";
import { colors, spacing, typography } from "@/theme";

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_LIST = Array.from({ length: CURRENT_YEAR - 1950 + 1 }, (_, i) => String(CURRENT_YEAR - i));

interface Props {
  libraryId: string;
  libraryName?: string;
}

export function LibraryCatalogScreen({ libraryId, libraryName }: Props) {
  const { t } = useTranslation("common");
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // État filtres
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedPlatformIds, setSelectedPlatformIds] = useState<number[]>([]);
  const [sortIndex, setSortIndex] = useState(0);
  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [sortSheetVisible, setSortSheetVisible] = useState(false);
  const [yearSheetVisible, setYearSheetVisible] = useState(false);
  const [advancedVisible, setAdvancedVisible] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>({
    genreIds: [], studioIds: [], platformIds: [], yearFrom: null, yearTo: null,
    ratingMin: null, isFavorite: false,
    sortBy: SORT_OPTIONS[0].sortBy, sortOrder: SORT_OPTIONS[0].sortOrder,
  });

  const advancedActiveCount = useMemo(() => {
    let c = 0;
    if (advancedFilters.studioIds.length > 0) c++;
    if (advancedFilters.yearFrom != null || advancedFilters.yearTo != null) c++;
    if (advancedFilters.ratingMin != null) c++;
    if (advancedFilters.isFavorite) c++;
    return c;
  }, [advancedFilters]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Construire les années pour le filtre avancé (range from/to)
  const yearsParam = useMemo(() => {
    if (advancedFilters.yearFrom != null || advancedFilters.yearTo != null) {
      const from = advancedFilters.yearFrom ?? 1900;
      const to = advancedFilters.yearTo ?? new Date().getFullYear();
      const arr: string[] = [];
      for (let y = from; y <= to; y++) arr.push(String(y));
      return arr;
    }
    return selectedYear ? [selectedYear] : undefined;
  }, [advancedFilters.yearFrom, advancedFilters.yearTo, selectedYear]);

  const catalog = useLibraryCatalog(libraryId, {
    sortBy: SORT_OPTIONS[sortIndex].sortBy,
    sortOrder: SORT_OPTIONS[sortIndex].sortOrder,
    genreIds: selectedGenres.length > 0 ? selectedGenres : undefined,
    years: yearsParam,
    statusFilter: statusFilter ?? undefined,
    searchTerm: debouncedSearch.length >= 2 ? debouncedSearch : undefined,
    studioIds: advancedFilters.studioIds.length > 0 ? advancedFilters.studioIds : undefined,
    minCommunityRating: advancedFilters.ratingMin ?? undefined,
    isFavorite: advancedFilters.isFavorite || undefined,
    limit: selectedPlatformIds.length > 0 ? 500 : undefined,
  });

  // Filtre plateforme TMDB côté client
  const allCatalogItems = useMemo(
    () => catalog.data?.pages.flatMap((p) => p.Items) ?? [],
    [catalog.data],
  );
  const { filteredItems: platformFiltered } = usePlatformFilter(allCatalogItems, selectedPlatformIds);
  const totalCount = selectedPlatformIds.length > 0
    ? platformFiltered.length
    : (catalog.data?.pages[0]?.TotalRecordCount ?? 0);

  const handleItemPress = useCallback(
    (item: MediaItem) => router.push(`/media/${item.Id}`),
    [router],
  );

  const handleSelectYear = useCallback((year: string | null) => {
    setSelectedYear(year);
    setYearSheetVisible(false);
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
          <Feather name="chevron-left" size={26} color={colors.accent} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>{libraryName ?? ""}</Text>
        <View style={styles.headerActions}>
          <Pressable onPress={() => setSearchVisible((v) => !v)} hitSlop={12}>
            <Feather name="search" size={20} color={searchVisible ? colors.accent : colors.textSecondary} />
          </Pressable>
          <Pressable onPress={() => setAdvancedVisible(true)} hitSlop={12} style={{ marginLeft: spacing.md }}>
            <View>
              <Feather name="sliders" size={20} color={advancedActiveCount > 0 ? colors.accent : colors.textSecondary} />
              {advancedActiveCount > 0 && (
                <View style={styles.headerBadge}>
                  <Text style={styles.headerBadgeText}>{advancedActiveCount}</Text>
                </View>
              )}
            </View>
          </Pressable>
        </View>
      </View>

      {/* Search bar */}
      {searchVisible && (
        <View style={styles.searchContainer}>
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t("searchInLibrary", { name: libraryName ?? "" })}
            placeholderTextColor={colors.textDim}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            style={styles.searchInput}
          />
        </View>
      )}

      {/* Genre chips */}
      <GenreFilter libraryId={libraryId} selectedGenres={selectedGenres} onGenresChange={setSelectedGenres} />

      {/* Filter bar: sort chip + year chip + status chips */}
      <View style={styles.filterBar}>
        <Pressable onPress={() => setSortSheetVisible(true)} style={styles.filterChip}>
          <Text style={styles.filterChipText}>{t(SORT_OPTIONS[sortIndex].labelKey)} ▼</Text>
        </Pressable>
        <Pressable onPress={() => setYearSheetVisible(true)} style={styles.filterChip}>
          <Text style={styles.filterChipText}>
            {selectedYear ?? t("allYears")} ▼
          </Text>
        </Pressable>
        <StatusFilter value={statusFilter} onChange={setStatusFilter} />
      </View>

      {/* Result count */}
      {!catalog.isLoading && (
        <Text style={styles.resultCount}>{t("resultCount", { count: totalCount })}</Text>
      )}

      {/* Grid */}
      <CatalogGrid
        catalog={catalog as any}
        onItemPress={handleItemPress}
        overrideItems={selectedPlatformIds.length > 0 ? platformFiltered : undefined}
      />

      {/* Sort BottomSheet */}
      <SortSelector
        sortIndex={sortIndex}
        onSortChange={setSortIndex}
        visible={sortSheetVisible}
        onClose={() => setSortSheetVisible(false)}
      />

      {/* Advanced Filter BottomSheet */}
      <AdvancedFilterSheet
        visible={advancedVisible}
        onClose={() => setAdvancedVisible(false)}
        libraryId={libraryId}
        filters={advancedFilters}
        onToggleGenre={(id) => setAdvancedFilters((f) => ({
          ...f,
          genreIds: f.genreIds.includes(id) ? f.genreIds.filter((g) => g !== id) : [...f.genreIds, id],
        }))}
        onToggleStudio={(id) => setAdvancedFilters((f) => ({
          ...f,
          studioIds: f.studioIds.includes(id) ? f.studioIds.filter((s) => s !== id) : [...f.studioIds, id],
        }))}
        onTogglePlatform={(id) => {
          setAdvancedFilters((f) => ({
            ...f,
            platformIds: f.platformIds.includes(id) ? f.platformIds.filter((p) => p !== id) : [...f.platformIds, id],
          }));
          setSelectedPlatformIds((prev) => prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]);
        }}
        onYearFromChange={(v) => setAdvancedFilters((f) => ({ ...f, yearFrom: v }))}
        onYearToChange={(v) => setAdvancedFilters((f) => ({ ...f, yearTo: v }))}
        onRatingMinChange={(v) => setAdvancedFilters((f) => ({ ...f, ratingMin: v }))}
        onFavoriteChange={(v) => setAdvancedFilters((f) => ({ ...f, isFavorite: v }))}
        onSortByChange={(sortBy, sortOrder) => setAdvancedFilters((f) => ({ ...f, sortBy, sortOrder }))}
        onReset={() => { setSelectedPlatformIds([]); setAdvancedFilters({
          genreIds: [], studioIds: [], platformIds: [], yearFrom: null, yearTo: null,
          ratingMin: null, isFavorite: false,
          sortBy: SORT_OPTIONS[0].sortBy, sortOrder: SORT_OPTIONS[0].sortOrder,
        }); }}
        activeCount={advancedActiveCount}
      />

      {/* Year BottomSheet */}
      <BottomSheet visible={yearSheetVisible} onClose={() => setYearSheetVisible(false)} snapPoints={[0.5, 0.8]}>
        <View style={styles.yearSheetHeader}>
          <Feather name="calendar" size={18} color={colors.accent} />
          <Text style={styles.yearSheetTitle}>{t("sortYear")}</Text>
        </View>
        <ScrollView showsVerticalScrollIndicator={false}>
          <Pressable onPress={() => handleSelectYear(null)} style={styles.yearOption}>
            <Text style={[styles.yearOptionText, selectedYear === null && styles.yearOptionActive]}>
              {t("allYears")}
            </Text>
            {selectedYear === null && <Feather name="check" size={18} color={colors.accent} />}
          </Pressable>
          {YEAR_LIST.map((year) => (
            <Pressable key={year} onPress={() => handleSelectYear(year)} style={styles.yearOption}>
              <Text style={[styles.yearOptionText, selectedYear === year && styles.yearOptionActive]}>
                {year}
              </Text>
              {selectedYear === year && <Feather name="check" size={18} color={colors.accent} />}
            </Pressable>
          ))}
        </ScrollView>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: spacing.sm,
  },
  backButton: { marginRight: spacing.sm },
  headerTitle: { ...typography.title, color: colors.textPrimary, flex: 1 },
  headerActions: { flexDirection: "row", alignItems: "center" },
  searchContainer: { paddingHorizontal: spacing.screenPadding, marginBottom: spacing.xs },
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
  filterBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.screenPadding,
    gap: spacing.xs,
    paddingVertical: 0,
    flexWrap: "wrap",
  },
  filterChip: {
    height: 30,
    paddingHorizontal: 10,
    borderRadius: 15,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  filterChipText: { ...typography.caption, color: colors.textSecondary, lineHeight: 16 },
  resultCount: {
    ...typography.caption,
    color: colors.textMuted,
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  yearSheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: spacing.md,
  },
  yearSheetTitle: { ...typography.subtitle, color: colors.textPrimary },
  yearOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: spacing.md,
  },
  yearOptionText: { ...typography.body, color: colors.textSecondary },
  yearOptionActive: { color: colors.accent, fontWeight: "600" },
  headerBadge: { position: "absolute", top: -4, right: -6, width: 14, height: 14, borderRadius: 7, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  headerBadgeText: { color: "#fff", fontSize: 8, fontWeight: "800" },
});
