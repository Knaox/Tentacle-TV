import { memo, useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { STATUS_OPTIONS } from "@/components/catalog/StatusFilter";
import { ScopedSearchField } from "@/components/search/ScopedSearchField";
import type { SearchAssist } from "@/components/search/useSearchAssist";
import { spacing, typography, FONT_FAMILY, useTheme, useThemedStyles, withAlpha, type AppTheme } from "@/theme";
import { COLLECTION_SORTS, DEFAULT_COLLECTION_SORT } from "@/screens/collection/collectionSorts";
import type { CollectionFiltersApi } from "@/screens/collection/useCollectionFilters";
import { CollectionFilterSheet } from "./CollectionFilterSheet";

/**
 * La barre de filtres de Ma liste et de Mes favoris sur téléphone.
 *
 * UNE rangée : le type (Tous, Films, Séries), la recherche et « Trier et
 * filtrer ». L'état de visionnage, le tri et les genres vivent dans la feuille
 * — ils prenaient trois rangées de pastilles fixes au-dessus de la grille, et
 * celle-ci ne commençait qu'au milieu de l'écran. Ce qui filtre est rappelé
 * dessous en pastilles qu'on retire d'un toucher, et seulement quand il y en a.
 *
 * La recherche se révèle d'une icône, comme au catalogue ; pendant la frappe,
 * les filtres s'effacent devant les suggestions (l'écran les montre à la
 * place de la grille, voir `SearchAssistPane`).
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
  const [sheetOpen, setSheetOpen] = useState(false);
  const { state, patch } = filters;

  // Ce qui filtre, en pastilles retirables — dans l'ordre de la feuille.
  const sort = COLLECTION_SORTS.find((s) => s.sortBy === state.sortBy);
  const status = STATUS_OPTIONS.find((o) => o.value !== null && o.value === state.statusFilter);
  const active: Array<{ key: string; label: string; remove: () => void }> = [
    ...(sort && sort.sortBy !== DEFAULT_COLLECTION_SORT.sortBy
      ? [{ key: "sort", label: t(sort.key), remove: () => patch({ sortBy: DEFAULT_COLLECTION_SORT.sortBy, sortOrder: DEFAULT_COLLECTION_SORT.sortOrder }) }]
      : []),
    ...(status ? [{ key: "status", label: t(status.labelKey), remove: () => patch({ statusFilter: null }) }] : []),
    ...state.genres.map((id) => ({
      key: `g-${id}`,
      label: filters.genres.find((g) => g.Id === id)?.Name ?? id,
      remove: () => patch({ genres: state.genres.filter((g) => g !== id) }),
    })),
  ];

  return (
    <View style={st.block}>
      {searchOpen ? (
        <ScopedSearchField
          assist={assist}
          placeholder={t("searchInLibrary", { name: "" }).trim()}
          count={state.search.length >= 2 ? filters.resultCount : null}
          onClear={() => {
            filters.setInput("");
            setSearchOpen(false);
          }}
          autoFocus
        />
      ) : (
        <View style={st.row}>
          <View style={st.tabs} accessibilityRole="tablist">
            {filters.tabs.map((tab) => {
              const selected = state.type === tab.key;
              return (
                <Pressable
                  key={tab.key}
                  onPress={() => patch({ type: tab.key })}
                  style={[st.tab, selected && st.tabActive]}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                >
                  <Text style={[st.tabText, selected && st.tabTextActive]}>{tab.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable onPress={() => setSearchOpen(true)} style={st.roundIcon} accessibilityRole="button" accessibilityLabel={t("search")}>
            <Feather name="search" size={19} color={colors.text.secondary} />
          </Pressable>
          <Pressable
            onPress={() => setSheetOpen(true)}
            style={[st.roundIcon, filters.activeCount > 0 && st.roundIconActive]}
            accessibilityRole="button"
            accessibilityLabel={filters.activeCount > 0 ? `${t("sortAndFilter")} (${filters.activeCount})` : t("sortAndFilter")}
          >
            <Feather name="sliders" size={18} color={filters.activeCount > 0 ? colors.brand.light : colors.text.secondary} />
            {filters.activeCount > 0 && (
              <View style={st.badge}><Text style={st.badgeText}>{filters.activeCount}</Text></View>
            )}
          </Pressable>
        </View>
      )}

      {!assist.open && active.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.activeRow}>
          {active.map((chip) => (
            <Pressable
              key={chip.key}
              onPress={chip.remove}
              style={st.activeChip}
              accessibilityRole="button"
              accessibilityLabel={t("removeFilterNamed", { name: chip.label })}
            >
              <Text style={st.activeChipText}>{chip.label}</Text>
              <Feather name="x" size={14} color={colors.brand.light} />
            </Pressable>
          ))}
          <Pressable onPress={filters.reset} style={st.clear} accessibilityRole="button">
            <Text style={st.clearText}>{t("resetFilters")}</Text>
          </Pressable>
        </ScrollView>
      )}

      <CollectionFilterSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} filters={filters} />
    </View>
  );
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    block: { gap: spacing.sm, paddingBottom: spacing.sm },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingHorizontal: spacing.screenPadding,
    },
    tabs: {
      flex: 1,
      flexDirection: "row",
      gap: 4,
      padding: 4,
      borderRadius: 999,
      backgroundColor: t.colors.fill.subtle,
    },
    tab: {
      flex: 1,
      minHeight: 36,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: spacing.sm,
    },
    tabActive: { backgroundColor: withAlpha(t.colors.brand.violet, 0.22, t.colors.fill.soft) },
    tabText: { ...typography.caption, fontSize: 14, fontFamily: FONT_FAMILY.medium, color: t.colors.text.tertiary },
    tabTextActive: { color: t.colors.brand.light, fontFamily: FONT_FAMILY.semibold },
    roundIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.colors.fill.subtle,
    },
    roundIconActive: { backgroundColor: t.colors.brand.soft },
    badge: {
      position: "absolute",
      top: -2,
      right: -2,
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      paddingHorizontal: 4,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.colors.brand.violet,
    },
    badgeText: { fontSize: 11, fontFamily: FONT_FAMILY.bold, color: "#fff" },
    activeRow: { gap: spacing.sm, paddingHorizontal: spacing.screenPadding, alignItems: "center" },
    activeChip: {
      minHeight: 36,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      borderRadius: 999,
      backgroundColor: t.colors.brand.soft,
      borderWidth: 1,
      borderColor: t.colors.brand.glow,
    },
    activeChipText: { ...typography.caption, fontFamily: FONT_FAMILY.semibold, color: t.colors.brand.light },
    clear: { minHeight: 36, justifyContent: "center", paddingHorizontal: 8 },
    clearText: { ...typography.caption, fontFamily: FONT_FAMILY.medium, color: t.colors.text.secondary },
  });
