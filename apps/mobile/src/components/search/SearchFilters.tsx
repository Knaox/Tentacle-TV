import { memo } from "react";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { useTranslation } from "react-i18next";
import type { SearchResponse } from "@tentacle-tv/shared";
import { FONT_FAMILY, RADIUS, spacing, useThemedStyles, type AppTheme } from "@/theme";

export type SearchFilter = "all" | "movies" | "series" | "collections" | "people" | "episodes";

export interface FilterOption {
  key: SearchFilter;
  /** `null` : le compte n'est pas connu (épisodes, demandés à part). */
  count: number | null;
}

/** Les filtres qui ont quelque chose à montrer — « Tout » d'abord, toujours. */
export function availableFilters(response: SearchResponse | undefined, episodeCount: number): FilterOption[] {
  const options: FilterOption[] = [{ key: "all", count: null }];
  if (!response) return options;
  const { totals } = response;
  if (totals.movies > 0) options.push({ key: "movies", count: totals.movies });
  if (totals.series > 0) options.push({ key: "series", count: totals.series });
  if (totals.collections > 0) options.push({ key: "collections", count: totals.collections });
  if (totals.people > 0) options.push({ key: "people", count: totals.people });
  if (episodeCount > 0) options.push({ key: "episodes", count: null });
  return options;
}

/**
 * Les filtres de la recherche, en pastilles sous le champ : resserrer d'un
 * geste sur les films, les séries, les personnes ou les épisodes — avec le
 * nombre de réponses de chacun. Un seul filtre (« Tout ») : rien à montrer.
 */
export const SearchFilters = memo(function SearchFilters({ options, active, onChange }: {
  options: FilterOption[];
  active: SearchFilter;
  onChange: (filter: SearchFilter) => void;
}) {
  const { t } = useTranslation("search");
  const st = useThemedStyles(makeStyles);
  if (options.length <= 1) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={st.row}
      keyboardShouldPersistTaps="handled"
      accessibilityRole="tablist"
    >
      {options.map(({ key, count }) => {
        const selected = key === active;
        return (
          <Pressable
            key={key}
            onPress={() => onChange(key)}
            hitSlop={4}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={({ pressed }) => [st.pill, selected && st.pillActive, pressed && !selected && st.pressed]}
          >
            <Text style={[st.label, selected && st.labelActive]}>{t(key)}</Text>
            {count !== null && <Text style={[st.count, selected && st.labelActive]}>{count}</Text>}
          </Pressable>
        );
      })}
    </ScrollView>
  );
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    row: { gap: 8, paddingHorizontal: spacing.screenPadding, paddingTop: spacing.sm },
    pill: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 6,
      height: 36,
      paddingHorizontal: 14,
      borderRadius: RADIUS.pill,
      borderWidth: 1,
      borderColor: t.colors.border.subtle,
      backgroundColor: t.colors.fill.subtle,
    },
    pillActive: { backgroundColor: t.colors.brand.soft, borderColor: t.colors.brand.glow },
    pressed: { opacity: 0.75 },
    label: { fontSize: 13, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.secondary },
    labelActive: { color: t.colors.brand.light },
    count: { fontSize: 12, fontFamily: FONT_FAMILY.medium, color: t.colors.text.tertiary },
  });
