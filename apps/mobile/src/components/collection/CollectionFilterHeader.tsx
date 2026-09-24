import { memo, useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { GenreFilter } from "@/components/catalog/GenreFilter";
import { StatusFilter } from "@/components/catalog/StatusFilter";
import { ScopedSearchField } from "@/components/search/ScopedSearchField";
import type { SearchAssist } from "@/components/search/useSearchAssist";
import { spacing, typography, FONT_FAMILY, useTheme, useThemedStyles, withAlpha, type AppTheme } from "@/theme";
import type { CollectionFiltersApi } from "@/screens/collection/useCollectionFilters";

const SORTS = [
  { key: "sortDateDesc", sortBy: "DateCreated", sortOrder: "Descending" },
  { key: "sortTitleAsc", sortBy: "SortName", sortOrder: "Ascending" },
  { key: "sortYearDesc", sortBy: "ProductionYear", sortOrder: "Descending" },
  { key: "sortRatingDesc", sortBy: "CommunityRating", sortOrder: "Descending" },
] as const;

/**
 * La barre de filtres de Ma liste et de Mes favoris sur téléphone.
 *
 * Elle reprend les composants du catalogue — `GenreFilter`, `StatusFilter` —
 * plutôt que d'en refaire : ce sont les mêmes gestes, ils doivent avoir la même
 * tête. La recherche se révèle d'une icône, comme là-bas, pour ne pas manger
 * une ligne entière sur un écran étroit ; pendant la frappe, les filtres
 * s'effacent devant les suggestions (l'écran les montre à la place de la
 * grille, voir `SearchAssistPane`).
 */
export const CollectionFilterHeader = memo(function CollectionFilterHeader({
  filters,
  assist,
}: {
  filters: CollectionFiltersApi;
  assist: SearchAssist;
}) {
  const { t } = useTranslation("common");
  const { colors } = useTheme();
  const st = useThemedStyles(makeStyles);
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <View style={st.block}>
      {searchOpen ? (
        <ScopedSearchField
          assist={assist}
          placeholder={t("searchInLibrary", { name: "" }).trim()}
          count={filters.state.search.length >= 2 ? filters.resultCount : null}
          onClear={() => {
            filters.setInput("");
            setSearchOpen(false);
          }}
          autoFocus
        />
      ) : (
        <View style={st.row}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.rowTabs} contentContainerStyle={st.tabs}>
            {filters.tabs.map((tab) => {
              const active = filters.state.type === tab.key;
              return (
                <Pressable
                  key={tab.key}
                  onPress={() => filters.patch({ type: tab.key })}
                  style={[st.chip, active && st.chipActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[st.chipText, active && st.chipTextActive]}>{tab.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <Pressable
            onPress={() => setSearchOpen(true)}
            hitSlop={10}
            style={st.roundIcon}
            accessibilityRole="button"
            accessibilityLabel={t("search")}
          >
            <Feather name="search" size={18} color={colors.text.secondary} />
          </Pressable>
        </View>
      )}

      {!assist.open && (
        <>
          <View style={st.inset}>
            <StatusFilter
              value={filters.state.statusFilter}
              onChange={(v) => filters.patch({ statusFilter: v })}
            />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.tabs}>
            {SORTS.map((sort) => {
              const active = filters.state.sortBy === sort.sortBy;
              return (
                <Pressable
                  key={sort.key}
                  onPress={() => filters.patch({ sortBy: sort.sortBy, sortOrder: sort.sortOrder })}
                  style={[st.chip, active && st.chipActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[st.chipText, active && st.chipTextActive]}>{t(sort.key)}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Les genres viennent des titres chargés — aucune requête. */}
          {filters.genres.length > 0 && (
            <GenreFilter
              genres={filters.genres}
              selectedGenres={filters.state.genres}
              onGenresChange={(g) => filters.patch({ genres: g })}
            />
          )}

          <View style={st.footer}>
            <Text style={st.count}>{t("resultCount", { count: filters.resultCount })}</Text>
            {filters.isFiltered && (
              <Pressable onPress={filters.reset} hitSlop={8} accessibilityRole="button">
                <Text style={st.reset}>{t("resetFilters")}</Text>
              </Pressable>
            )}
          </View>
        </>
      )}
    </View>
  );
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    block: { gap: spacing.sm, paddingBottom: spacing.sm },
    // Les onglets défilent jusqu'au bord gauche ; leur marge est celle de leur contenu.
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingRight: spacing.screenPadding,
    },
    rowTabs: { flex: 1 },
    inset: { paddingHorizontal: spacing.screenPadding },
    tabs: { gap: spacing.xs, paddingHorizontal: spacing.screenPadding },
    chip: {
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: t.colors.fill.subtle,
    },
    chipActive: {
      backgroundColor: withAlpha(t.colors.brand.violet, 0.2, t.colors.fill.soft),
    },
    chipText: { ...typography.caption, fontFamily: FONT_FAMILY.medium, color: t.colors.text.tertiary },
    chipTextActive: { color: t.colors.brand.light },
    roundIcon: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.colors.fill.subtle,
    },
    footer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.screenPadding,
    },
    count: { ...typography.badge, fontFamily: FONT_FAMILY.medium, color: t.colors.text.tertiary },
    reset: { ...typography.badge, fontFamily: FONT_FAMILY.medium, color: t.colors.text.secondary },
  });
