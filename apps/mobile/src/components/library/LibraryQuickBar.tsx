import { memo } from "react";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { SORT_OPTIONS } from "@/components/catalog";
import { SegmentedChoice } from "@/components/settings/SegmentedChoice";
import { FONT_FAMILY, RADIUS, spacing, useTheme, useThemedStyles, withAlpha, type AppTheme } from "@/theme";
import type { LibraryCatalogState } from "@/screens/library/useLibraryCatalogState";

const ALL = "all";

/**
 * Les trois réglages qu'on touche le plus, sous le pouce, sans ouvrir la
 * feuille : le statut de visionnage en contrôle segmenté (le même que les
 * réglages), les favoris, et le tri en cours — qui ouvre « Trier et
 * filtrer », où il se change.
 *
 * Tout le reste (genres, années, note, plateformes, studios) reste dans la
 * feuille : la grille doit commencer haut. La rangée défile à l'horizontale
 * si l'écran est étroit, jamais sur deux lignes.
 */
export const LibraryQuickBar = memo(function LibraryQuickBar({ state }: { state: LibraryCatalogState }) {
  const { t } = useTranslation(["common", "library"]);
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const sort = SORT_OPTIONS[state.sortIndex];
  const favorite = state.advancedFilters.isFavorite;
  const sortIcon = sort.sortOrder === "Descending" ? "arrow-down" : "arrow-up";

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={st.row}
      keyboardShouldPersistTaps="handled"
    >
      <SegmentedChoice
        compact
        accessibilityLabel={t("library:watchStatus")}
        value={state.statusFilter ?? ALL}
        onChange={(v) => state.setStatusFilter(v === ALL ? null : v)}
        options={[
          { value: ALL, label: t("common:allFilter") },
          { value: "IsUnplayed", label: t("common:unwatched") },
          { value: "IsResumable", label: t("common:inProgress") },
        ]}
      />
      <Pressable
        onPress={() => state.advanced.onFavoriteChange(!favorite)}
        hitSlop={{ top: 6, bottom: 6 }}
        accessibilityRole="button"
        accessibilityState={{ selected: favorite }}
        accessibilityLabel={t("common:favorites")}
        style={({ pressed }) => [st.chip, favorite && st.chipFavorite, pressed && st.pressed]}
      >
        <Feather name="heart" size={14} color={favorite ? theme.colors.brand.accentLight : theme.colors.text.secondary} />
        <Text style={[st.chipText, favorite && st.chipTextFavorite]}>{t("common:favorites")}</Text>
      </Pressable>
      <Pressable
        onPress={() => state.setSheet("filters")}
        hitSlop={{ top: 6, bottom: 6 }}
        accessibilityRole="button"
        accessibilityLabel={t("library:sortedBy", { sort: t(`common:${sort.labelKey}`) })}
        style={({ pressed }) => [st.chip, pressed && st.pressed]}
      >
        <Feather name={sortIcon} size={14} color={theme.colors.brand.light} />
        <Text style={st.chipText} numberOfLines={1}>{t(`common:${sort.labelKey}`)}</Text>
        <Feather name="chevron-down" size={14} color={theme.colors.text.tertiary} />
      </Pressable>
    </ScrollView>
  );
});

const makeStyles = (t: AppTheme) => StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.screenPadding, paddingVertical: spacing.xs },
  chip: {
    height: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: RADIUS.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border.strong,
    backgroundColor: t.colors.surface.s1,
  },
  chipFavorite: { borderColor: t.colors.brand.accent, backgroundColor: withAlpha(t.colors.brand.accent, 0.16, t.colors.surface.s1) },
  chipText: { fontSize: 13, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.secondary },
  chipTextFavorite: { color: t.colors.brand.accentLight },
  pressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },
});
