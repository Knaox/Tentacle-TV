import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useGenres } from "@tentacle-tv/api-client";
import { CatalogFilterSheet, PLATFORMS, SORT_OPTIONS, STATUS_OPTIONS } from "@/components/catalog";
import { spacing, typography, FONT_FAMILY, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import type { LibraryCatalogState } from "./useLibraryCatalogState";

/**
 * Sous la recherche d'un catalogue : ce qui le filtre, en pastilles qu'on
 * retire d'un toucher — et SEULEMENT quand il y en a. Les réglages eux-mêmes
 * vivent dans « Trier et filtrer » : genres, tri, année et visionnage
 * prenaient ici trois rangées de pastilles, et la grille commençait aux deux
 * tiers de l'écran. Communs à l'onglet Bibliothèque et à l'écran d'une
 * bibliothèque.
 */
export function LibraryFilterBar({ state, showCount = true }: { state: LibraryCatalogState; showCount?: boolean }) {
  const { t } = useTranslation("common");
  const { colors } = useTheme();
  const st = useThemedStyles(makeStyles);
  const { data: genres } = useGenres(state.libraryId);
  const { advancedFilters: f, advanced } = state;

  const status = STATUS_OPTIONS.find((o) => o.value !== null && o.value === state.statusFilter);
  const chips: Array<{ key: string; label: string; remove: () => void }> = [
    ...(state.sortIndex !== 0 ? [{ key: "sort", label: t(SORT_OPTIONS[state.sortIndex].labelKey), remove: () => state.setSortIndex(0) }] : []),
    ...(status ? [{ key: "status", label: t(status.labelKey), remove: () => state.setStatusFilter(null) }] : []),
    ...state.selectedGenres.map((id) => ({
      key: `g-${id}`, label: genres?.find((g) => g.Id === id)?.Name ?? id, remove: () => advanced.onToggleGenre(id),
    })),
    ...f.platformIds.map((id) => ({
      key: `p-${id}`, label: PLATFORMS.find((p) => p.id === id)?.name ?? String(id), remove: () => advanced.onTogglePlatform(id),
    })),
    ...(f.yearFrom != null || f.yearTo != null
      ? [{ key: "years", label: f.yearFrom === f.yearTo ? String(f.yearFrom) : `${f.yearFrom ?? "…"} – ${f.yearTo ?? "…"}`, remove: () => { advanced.onYearFromChange(null); advanced.onYearToChange(null); } }]
      : []),
    ...(f.ratingMin != null ? [{ key: "rating", label: `≥ ${f.ratingMin}/10`, remove: () => advanced.onRatingMinChange(null) }] : []),
    ...(f.isFavorite ? [{ key: "fav", label: `♥ ${t("favorites")}`, remove: () => advanced.onFavoriteChange(false) }] : []),
  ];

  return (
    <View>
      {chips.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.row}>
          {chips.map((chip) => (
            <Pressable
              key={chip.key}
              onPress={chip.remove}
              style={st.chip}
              accessibilityRole="button"
              accessibilityLabel={t("removeFilterNamed", { name: chip.label })}
            >
              <Text style={st.chipText}>{chip.label}</Text>
              <Feather name="x" size={14} color={colors.brand.light} />
            </Pressable>
          ))}
          <Pressable onPress={advanced.onReset} style={st.clear} accessibilityRole="button">
            <Text style={st.clearText}>{t("resetFilters")}</Text>
          </Pressable>
        </ScrollView>
      )}
      {showCount && !state.catalog.isLoading && (
        <Text style={st.resultCount}>{t("resultCount", { count: state.totalCount })}</Text>
      )}
    </View>
  );
}

/** La feuille « Trier et filtrer » d'un catalogue. */
export function LibrarySheets({ state }: { state: LibraryCatalogState }) {
  return (
    <CatalogFilterSheet
      visible={state.sheet === "filters"}
      onClose={() => state.setSheet(null)}
      libraryId={state.libraryId}
      sortIndex={state.sortIndex}
      onSortIndex={state.setSortIndex}
      statusFilter={state.statusFilter}
      onStatusFilter={state.setStatusFilter}
      selectedGenres={state.selectedGenres}
      filters={state.advancedFilters}
      activeCount={state.filterCount}
      resultCount={state.catalog.isLoading ? null : state.totalCount}
      {...state.advanced}
    />
  );
}

const makeStyles = (t: AppTheme) => StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.screenPadding, paddingVertical: spacing.xs },
  chip: {
    minHeight: 36, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12,
    borderRadius: 999, backgroundColor: t.colors.brand.soft, borderWidth: 1, borderColor: t.colors.brand.glow,
  },
  chipText: { ...typography.caption, fontFamily: FONT_FAMILY.semibold, color: t.colors.brand.light },
  clear: { minHeight: 36, justifyContent: "center", paddingHorizontal: 8 },
  clearText: { ...typography.caption, fontFamily: FONT_FAMILY.medium, color: t.colors.text.secondary },
  resultCount: { ...typography.caption, fontFamily: FONT_FAMILY.medium, color: t.colors.text.tertiary, paddingHorizontal: spacing.screenPadding, paddingTop: 4, paddingBottom: spacing.sm },
});
