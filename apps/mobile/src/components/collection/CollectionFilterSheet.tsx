import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { FilterChip, FilterSection } from "@/components/filters/FilterChip";
import { STATUS_OPTIONS } from "@/components/catalog/StatusFilter";
import { COLLECTION_SORTS } from "@/screens/collection/collectionSorts";
import type { CollectionFiltersApi } from "@/screens/collection/useCollectionFilters";
import { FONT_FAMILY, spacing, typography, useThemedStyles, type AppTheme } from "@/theme";

/**
 * « Trier et filtrer » pour Ma liste et Mes favoris : le tri, l'état de
 * visionnage et les genres, qui prenaient trois rangées de pastilles fixes
 * au-dessus de la grille (≈ 300 pt sur un iPhone SE). Chaque geste s'applique
 * aussitôt ; le pied dit combien de titres on va voir.
 */
export function CollectionFilterSheet({ visible, onClose, filters }: {
  visible: boolean;
  onClose: () => void;
  filters: CollectionFiltersApi;
}) {
  const { t } = useTranslation("common");
  const st = useThemedStyles(makeStyles);
  const { state, patch } = filters;
  const toggleGenre = (id: string) =>
    patch({ genres: state.genres.includes(id) ? state.genres.filter((g) => g !== id) : [...state.genres, id] });

  return (
    <BottomSheet visible={visible} onClose={onClose} snapPoints={[0.66, 0.95]}>
      <View style={st.fill}>
        <View style={st.head}>
          <Text style={st.heading} accessibilityRole="header">{t("sortAndFilter")}</Text>
          {filters.activeCount > 0 && (
            <Pressable onPress={filters.reset} hitSlop={8} accessibilityRole="button" style={st.reset}>
              <Text style={st.resetText}>{t("resetFilters")}</Text>
            </Pressable>
          )}
        </View>
        <ScrollView contentContainerStyle={st.body} showsVerticalScrollIndicator={false}>
          <FilterSection title={t("sortBy")}>
            {COLLECTION_SORTS.map((sort) => (
              <FilterChip
                key={sort.key}
                label={t(sort.key)}
                active={state.sortBy === sort.sortBy}
                onPress={() => patch({ sortBy: sort.sortBy, sortOrder: sort.sortOrder })}
              />
            ))}
          </FilterSection>
          <FilterSection title={t("watchStatus")}>
            {STATUS_OPTIONS.map((opt) => (
              <FilterChip
                key={opt.labelKey}
                label={t(opt.labelKey)}
                active={state.statusFilter === opt.value}
                onPress={() => patch({ statusFilter: opt.value })}
              />
            ))}
          </FilterSection>
          {filters.genres.length > 0 && (
            <FilterSection title={t("genres")}>
              <FilterChip label={t("allFilter")} active={state.genres.length === 0} onPress={() => patch({ genres: [] })} />
              {filters.genres.map((genre) => (
                <FilterChip
                  key={genre.Id}
                  label={genre.Name}
                  active={state.genres.includes(genre.Id)}
                  onPress={() => toggleGenre(genre.Id)}
                />
              ))}
            </FilterSection>
          )}
        </ScrollView>
        <View style={st.foot}>
          <Button title={t("showResultsCount", { count: filters.resultCount })} onPress={onClose} fullWidth />
        </View>
      </View>
    </BottomSheet>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    fill: { flex: 1 },
    head: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "space-between" as const,
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
    },
    heading: { ...typography.subtitle, fontFamily: FONT_FAMILY.bold, color: t.colors.text.primary },
    reset: { minHeight: 40, justifyContent: "center" as const, paddingHorizontal: 4 },
    resetText: { ...typography.caption, fontFamily: FONT_FAMILY.semibold, color: t.colors.brand.light },
    body: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.xl },
    foot: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.border.subtle,
    },
  });
