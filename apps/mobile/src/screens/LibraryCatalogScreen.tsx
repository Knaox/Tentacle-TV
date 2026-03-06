import { useState, useEffect, useCallback, useMemo } from "react";
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useLibraryCatalog } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { BottomSheet } from "@/components/ui";
import { GenreFilter, SortSelector, StatusFilter, CatalogGrid, SORT_OPTIONS } from "@/components/catalog";
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
  const [sortIndex, setSortIndex] = useState(0);
  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [sortSheetVisible, setSortSheetVisible] = useState(false);
  const [yearSheetVisible, setYearSheetVisible] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const catalog = useLibraryCatalog(libraryId, {
    sortBy: SORT_OPTIONS[sortIndex].sortBy,
    sortOrder: SORT_OPTIONS[sortIndex].sortOrder,
    genreIds: selectedGenres.length > 0 ? selectedGenres : undefined,
    years: selectedYear ? [selectedYear] : undefined,
    statusFilter: statusFilter ?? undefined,
    searchTerm: debouncedSearch.length >= 2 ? debouncedSearch : undefined,
  });

  const totalCount = catalog.data?.pages[0]?.TotalRecordCount ?? 0;

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
          <Pressable onPress={() => setSortSheetVisible(true)} hitSlop={12} style={{ marginLeft: spacing.md }}>
            <Feather name="sliders" size={20} color={colors.textSecondary} />
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
      <CatalogGrid catalog={catalog as any} onItemPress={handleItemPress} />

      {/* Sort BottomSheet */}
      <SortSelector
        sortIndex={sortIndex}
        onSortChange={setSortIndex}
        visible={sortSheetVisible}
        onClose={() => setSortSheetVisible(false)}
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
});
