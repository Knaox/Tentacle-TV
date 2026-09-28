import { memo, useState, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { STATUS_OPTIONS } from "@/components/catalog/StatusFilter";
import { FilterButton } from "@/components/library/LibrarySearchRow";
import { ScopedSearchField } from "@/components/search/ScopedSearchField";
import type { SearchAssist } from "@/components/search/useSearchAssist";
import { SegmentedChoice } from "@/components/settings/SegmentedChoice";
import { COLLECTION_SORTS, DEFAULT_COLLECTION_SORT } from "@/screens/collection/collectionSorts";
import type { CollectionFiltersApi } from "@/screens/collection/useCollectionFilters";
import { FONT_FAMILY, RADIUS, spacing, typography, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import { CollectionFilterSheet } from "./CollectionFilterSheet";
import { QuickChip, QuickChipText } from "./QuickChip";

/**
 * Recherche et filtres de Ma liste et de Mes favoris, À LA FORME de la
 * Bibliothèque (`LibraryCatalogView`) : le champ toujours visible et, à côté,
 * « Trier et filtrer » avec son nombre ; `lead` (les étapes de Ma liste) ;
 * puis la barre rapide qui défile d'un doigt — le type en segmenté compact
 * (celui des réglages), le tri en cours (qui ouvre la feuille) et `quick` au
 * bout. Ce qui filtre encore est rappelé dessous, en pastilles qu'on retire.
 *
 * Pendant la frappe, filtres et barre s'effacent devant les suggestions,
 * que l'écran montre à la place de la grille (`SearchAssistPane`).
 */
export const CollectionControls = memo(function CollectionControls({
  filters, assist, name, lead, quick, onSearchRowY,
}: {
  filters: CollectionFiltersApi;
  assist: SearchAssist;
  /** Nom de la collection, pour l'invite du champ. */
  name: string;
  lead?: ReactNode;
  quick?: ReactNode;
  /** Où tombe la rangée du champ dans la liste — pour la remonter à la frappe. */
  onSearchRowY?: (y: number) => void;
}) {
  const { t } = useTranslation(["common", "library", "watchlist"]);
  const { colors } = useTheme();
  const st = useThemedStyles(makeStyles);
  const [sheetOpen, setSheetOpen] = useState(false);
  const { state, patch } = filters;

  const sort = COLLECTION_SORTS.find((s) => s.sortBy === state.sortBy) ?? DEFAULT_COLLECTION_SORT;
  const status = STATUS_OPTIONS.find((o) => o.value !== null && o.value === state.statusFilter);
  // Le tri a sa pastille dans la barre rapide : on ne le répète pas ici.
  const active: Array<{ key: string; label: string; remove: () => void }> = [
    ...(status ? [{ key: "status", label: t(`common:${status.labelKey}`), remove: () => patch({ statusFilter: null }) }] : []),
    ...state.genres.map((id) => ({
      key: `g-${id}`,
      label: filters.genres.find((g) => g.Id === id)?.Name ?? id,
      remove: () => patch({ genres: state.genres.filter((g) => g !== id) }),
    })),
  ];

  return (
    <View>
      <View style={st.searchRow} onLayout={onSearchRowY ? (e) => onSearchRowY(e.nativeEvent.layout.y) : undefined}>
        <ScopedSearchField
          assist={assist}
          placeholder={t("common:searchInLibrary", { name })}
          count={state.search.length >= 2 ? filters.resultCount : null}
          inset={false}
        />
        <FilterButton count={filters.activeCount} onPress={() => setSheetOpen(true)} label={t("common:sortAndFilter")} />
      </View>

      {!assist.open && (
        <>
          {lead}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.quickRow} keyboardShouldPersistTaps="handled">
            <SegmentedChoice
              compact
              accessibilityLabel={t("watchlist:typeFilterLabel")}
              value={state.type}
              onChange={(v) => patch({ type: v as typeof state.type })}
              options={filters.tabs.map((tab) => ({ value: tab.key, label: tab.label }))}
            />
            <QuickChip onPress={() => setSheetOpen(true)} label={t("library:sortedBy", { sort: t(`common:${sort.key}`) })}>
              <Feather name={sort.sortOrder === "Ascending" ? "arrow-up" : "arrow-down"} size={14} color={colors.brand.light} />
              <QuickChipText>{t(`common:${sort.key}`)}</QuickChipText>
              <Feather name="chevron-down" size={14} color={colors.text.tertiary} />
            </QuickChip>
            {quick}
          </ScrollView>

          {active.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.activeRow}>
              {active.map((chip) => (
                <Pressable
                  key={chip.key}
                  onPress={chip.remove}
                  style={st.activeChip}
                  accessibilityRole="button"
                  accessibilityLabel={t("common:removeFilterNamed", { name: chip.label })}
                >
                  <Text style={st.activeChipText}>{chip.label}</Text>
                  <Feather name="x" size={14} color={colors.brand.light} />
                </Pressable>
              ))}
              <Pressable onPress={filters.reset} style={st.clear} accessibilityRole="button">
                <Text style={st.clearText}>{t("common:resetFilters")}</Text>
              </Pressable>
            </ScrollView>
          )}
        </>
      )}

      <CollectionFilterSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} filters={filters} />
    </View>
  );
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    searchRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingHorizontal: spacing.screenPadding,
      marginTop: spacing.md,
      marginBottom: spacing.xs,
    },
    quickRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.screenPadding, paddingTop: spacing.xs, paddingBottom: spacing.md },
    activeRow: { gap: spacing.sm, paddingHorizontal: spacing.screenPadding, paddingBottom: spacing.md, alignItems: "center" },
    activeChip: {
      minHeight: 36,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      borderRadius: RADIUS.pill,
      backgroundColor: t.colors.brand.soft,
      borderWidth: 1,
      borderColor: t.colors.brand.glow,
    },
    activeChipText: { ...typography.caption, fontFamily: FONT_FAMILY.semibold, color: t.colors.brand.light },
    clear: { minHeight: 36, justifyContent: "center", paddingHorizontal: 8 },
    clearText: { ...typography.caption, fontFamily: FONT_FAMILY.medium, color: t.colors.text.secondary },
  });
