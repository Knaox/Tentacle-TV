import { useState, useEffect, useCallback, useMemo } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useLibraryCatalog } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { SubtleBackground } from "@/components/ui";
import {
  GenreFilter, SortSelector, StatusFilter, CatalogGrid,
  SORT_OPTIONS, AdvancedFilterSheet, YearSheet,
} from "@/components/catalog";
import { usePlatformFilter } from "@/hooks/usePlatformFilter";
import type { AdvancedFilters } from "@/components/catalog";
import { colors, spacing, typography, BRAND, BORDER, FONT_FAMILY, RADIUS } from "@/theme";

interface Props { libraryId: string; libraryName?: string }

/**
 * Library catalog — header sticky avec back + titre Inter ExtraBold + search/
 * filters icon, chips de filtre (genres/sort/year/status), grille infinie.
 * Ambient orbe violet en haut.
 */
export function LibraryCatalogScreen({ libraryId, libraryName }: Props) {
  const { t } = useTranslation("common");
  const router = useRouter();
  const insets = useSafeAreaInsets();

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

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

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

  return (
    <SubtleBackground ambient>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header sticky */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn} accessibilityRole="button" accessibilityLabel={t("back")}>
            <Feather name="chevron-left" size={26} color="#fff" />
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>{libraryName ?? ""}</Text>
          <View style={styles.headerActions}>
            <Pressable onPress={() => setSearchVisible((v) => !v)} hitSlop={12} accessibilityRole="button" accessibilityLabel={t("search")}>
              <Feather name="search" size={20} color={searchVisible ? BRAND.violet : "rgba(255,255,255,0.78)"} />
            </Pressable>
            <Pressable onPress={() => setAdvancedVisible(true)} hitSlop={12} style={{ marginLeft: spacing.md }} accessibilityRole="button" accessibilityLabel={t("filters")}>
              <View>
                <Feather name="sliders" size={20} color={advancedActiveCount > 0 ? BRAND.violet : "rgba(255,255,255,0.78)"} />
                {advancedActiveCount > 0 && (
                  <View style={styles.headerBadge}>
                    <Text style={styles.headerBadgeText}>{advancedActiveCount}</Text>
                  </View>
                )}
              </View>
            </Pressable>
          </View>
        </View>

        {/* Search input */}
        {searchVisible && (
          <View style={styles.searchContainer}>
            <View style={styles.searchInputWrap}>
              <Feather name="search" size={16} color="rgba(255,255,255,0.45)" />
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
              {searchQuery.length > 0 && (
                <Pressable onPress={() => setSearchQuery("")} hitSlop={8}>
                  <Feather name="x" size={16} color="rgba(255,255,255,0.45)" />
                </Pressable>
              )}
            </View>
          </View>
        )}

        {/* Genre chips */}
        <GenreFilter libraryId={libraryId} selectedGenres={selectedGenres} onGenresChange={setSelectedGenres} />

        {/* Filter bar */}
        <View style={styles.filterBar}>
          <FilterChip label={t(SORT_OPTIONS[sortIndex].labelKey)} onPress={() => setSortSheetVisible(true)} />
          <FilterChip label={selectedYear ?? t("allYears")} onPress={() => setYearSheetVisible(true)} active={selectedYear !== null} />
          <StatusFilter value={statusFilter} onChange={setStatusFilter} />
        </View>

        {!catalog.isLoading && (
          <Text style={styles.resultCount}>{t("resultCount", { count: totalCount })}</Text>
        )}

        <CatalogGrid
          catalog={catalog as any}
          onItemPress={handleItemPress}
          overrideItems={selectedPlatformIds.length > 0 ? platformFiltered : undefined}
        />

        <SortSelector
          sortIndex={sortIndex}
          onSortChange={setSortIndex}
          visible={sortSheetVisible}
          onClose={() => setSortSheetVisible(false)}
        />

        <YearSheet
          visible={yearSheetVisible}
          onClose={() => setYearSheetVisible(false)}
          selectedYear={selectedYear}
          onSelect={setSelectedYear}
        />

        <AdvancedFilterSheet
          visible={advancedVisible}
          onClose={() => setAdvancedVisible(false)}
          libraryId={libraryId}
          filters={advancedFilters}
          onToggleGenre={(id) => setAdvancedFilters((f) => ({
            ...f, genreIds: f.genreIds.includes(id) ? f.genreIds.filter((g) => g !== id) : [...f.genreIds, id],
          }))}
          onToggleStudio={(id) => setAdvancedFilters((f) => ({
            ...f, studioIds: f.studioIds.includes(id) ? f.studioIds.filter((s) => s !== id) : [...f.studioIds, id],
          }))}
          onTogglePlatform={(id) => {
            setAdvancedFilters((f) => ({
              ...f, platformIds: f.platformIds.includes(id) ? f.platformIds.filter((p) => p !== id) : [...f.platformIds, id],
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
      </View>
    </SubtleBackground>
  );
}

function FilterChip({ label, onPress, active }: { label: string; onPress: () => void; active?: boolean }) {
  return (
    <Pressable onPress={onPress} style={[styles.filterChip, active && styles.filterChipActive]} accessibilityRole="button" accessibilityLabel={label}>
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text>
      <Feather name="chevron-down" size={12} color={active ? BRAND.violet : "rgba(255,255,255,0.6)"} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.screenPadding, paddingVertical: spacing.sm, gap: 4 },
  backBtn: { marginRight: spacing.xs, padding: 4 },
  headerTitle: { ...typography.title, fontFamily: FONT_FAMILY.extrabold, fontSize: 22, letterSpacing: -0.4, color: colors.textPrimary, flex: 1 },
  headerActions: { flexDirection: "row", alignItems: "center" },
  searchContainer: { paddingHorizontal: spacing.screenPadding, marginBottom: spacing.sm },
  searchInputWrap: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: BORDER.subtle,
    borderRadius: RADIUS.md, paddingHorizontal: spacing.md, height: 44,
  },
  searchInput: { flex: 1, ...typography.body, fontFamily: FONT_FAMILY.regular, color: colors.textPrimary, padding: 0 },
  filterBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.screenPadding, gap: 8, paddingVertical: spacing.xs, flexWrap: "wrap" },
  filterChip: { flexDirection: "row", alignItems: "center", gap: 6, height: 32, paddingHorizontal: 12, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: BORDER.subtle },
  filterChipActive: { backgroundColor: "rgba(139,92,246,0.15)", borderColor: "rgba(139,92,246,0.45)" },
  filterChipText: { ...typography.caption, fontFamily: FONT_FAMILY.semibold, color: "rgba(255,255,255,0.78)" },
  filterChipTextActive: { color: BRAND.light },
  resultCount: { ...typography.caption, fontFamily: FONT_FAMILY.medium, color: colors.textMuted, paddingHorizontal: spacing.screenPadding, paddingTop: 4, paddingBottom: spacing.sm },
  headerBadge: { position: "absolute" as const, top: -4, right: -6, width: 15, height: 15, borderRadius: 8, backgroundColor: BRAND.violet, alignItems: "center" as const, justifyContent: "center" as const },
  headerBadgeText: { color: "#fff", fontSize: 9, fontFamily: FONT_FAMILY.extrabold },
});
