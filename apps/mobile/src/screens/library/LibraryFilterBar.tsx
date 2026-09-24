import { StyleSheet, Text, View, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import {
  AdvancedFilterSheet, GenreFilter, SORT_OPTIONS, SortSelector, StatusFilter, YearSheet,
} from "@/components/catalog";
import { spacing, typography, FONT_FAMILY, useTheme, useThemedStyles, withAlpha, type AppTheme } from "@/theme";
import type { LibraryCatalogState } from "./useLibraryCatalogState";

/**
 * Les filtres d'un catalogue sous la barre de recherche — genres en
 * pastilles, puis tri, année et statut — et le nombre de titres. Communs à
 * l'onglet Bibliothèque et à l'écran d'une bibliothèque.
 */
export function LibraryFilterBar({ state, showCount = true }: { state: LibraryCatalogState; showCount?: boolean }) {
  const { t } = useTranslation("common");
  const st = useThemedStyles(makeStyles);
  return (
    <View>
      <GenreFilter libraryId={state.libraryId} selectedGenres={state.selectedGenres} onGenresChange={state.setSelectedGenres} />
      <View style={st.filterBar}>
        <FilterChip label={t(SORT_OPTIONS[state.sortIndex].labelKey)} onPress={() => state.setSheet("sort")} />
        <FilterChip label={state.selectedYear ?? t("allYears")} onPress={() => state.setSheet("year")} active={state.selectedYear !== null} />
        <StatusFilter value={state.statusFilter} onChange={state.setStatusFilter} />
      </View>
      {showCount && !state.catalog.isLoading && (
        <Text style={st.resultCount}>{t("resultCount", { count: state.totalCount })}</Text>
      )}
    </View>
  );
}

/** Les feuilles de tri, d'année et de filtres avancés d'un catalogue. */
export function LibrarySheets({ state }: { state: LibraryCatalogState }) {
  return (
    <>
      <SortSelector
        sortIndex={state.sortIndex}
        onSortChange={state.setSortIndex}
        visible={state.sheet === "sort"}
        onClose={() => state.setSheet(null)}
      />
      <YearSheet
        visible={state.sheet === "year"}
        onClose={() => state.setSheet(null)}
        selectedYear={state.selectedYear}
        onSelect={state.setSelectedYear}
      />
      <AdvancedFilterSheet
        visible={state.sheet === "advanced"}
        onClose={() => state.setSheet(null)}
        libraryId={state.libraryId}
        filters={state.advancedFilters}
        activeCount={state.advancedActiveCount}
        {...state.advanced}
      />
    </>
  );
}

function FilterChip({ label, onPress, active }: { label: string; onPress: () => void; active?: boolean }) {
  const { colors } = useTheme();
  const st = useThemedStyles(makeStyles);
  return (
    <Pressable onPress={onPress} style={[st.filterChip, active && st.filterChipActive]} accessibilityRole="button" accessibilityLabel={label}>
      <Text style={[st.filterChipText, active && st.filterChipTextActive]}>{label}</Text>
      <Feather name="chevron-down" size={12} color={active ? colors.brand.violet : colors.text.tertiary} />
    </Pressable>
  );
}

const makeStyles = (t: AppTheme) => StyleSheet.create({
  filterBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.screenPadding, gap: 8, paddingVertical: spacing.xs, flexWrap: "wrap" },
  filterChip: { flexDirection: "row", alignItems: "center", gap: 6, height: 32, paddingHorizontal: 12, borderRadius: 16, backgroundColor: t.colors.fill.subtle, borderWidth: 1, borderColor: t.colors.border.subtle },
  filterChipActive: { backgroundColor: t.colors.brand.soft, borderColor: withAlpha(t.colors.brand.violet, 0.45, t.colors.brand.glow) },
  filterChipText: { ...typography.caption, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.secondary },
  filterChipTextActive: { color: t.colors.brand.light },
  resultCount: { ...typography.caption, fontFamily: FONT_FAMILY.medium, color: t.colors.text.tertiary, paddingHorizontal: spacing.screenPadding, paddingTop: 4, paddingBottom: spacing.sm },
});
