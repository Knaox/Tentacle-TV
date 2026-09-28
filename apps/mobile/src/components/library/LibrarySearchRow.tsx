import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { ScopedSearchField } from "@/components/search/ScopedSearchField";
import { FONT_FAMILY, RADIUS, spacing, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import type { LibraryCatalogState } from "@/screens/library/useLibraryCatalogState";

/**
 * Le champ de recherche d'une bibliothèque et, à côté, le bouton « Trier et
 * filtrer » avec le nombre de réglages posés. Commun à l'onglet et à l'écran
 * d'une bibliothèque ouverte d'ailleurs.
 */
export const LibrarySearchRow = memo(function LibrarySearchRow({ state, libraryName, onLayoutY }: {
  state: LibraryCatalogState;
  libraryName: string;
  /** Où tombe la rangée dans la liste — pour la remonter sous l'en-tête à la frappe. */
  onLayoutY?: (y: number) => void;
}) {
  const { t } = useTranslation("common");
  const st = useThemedStyles(makeStyles);
  const { assist, catalog, searching, totalCount } = state;
  return (
    <View style={st.row} onLayout={onLayoutY ? (e) => onLayoutY(e.nativeEvent.layout.y) : undefined}>
      <ScopedSearchField
        assist={assist}
        placeholder={t("searchInLibrary", { name: libraryName })}
        count={searching && !catalog.isLoading ? totalCount : null}
        inset={false}
      />
      <FilterButton count={state.filterCount} onPress={() => state.setSheet("filters")} />
    </View>
  );
});

/**
 * Les filtres avancés, à côté du champ — avec leur nombre quand il y en a.
 * Ma liste et Mes favoris posent le même (« Trier et filtrer »).
 */
export function FilterButton({ count, onPress, label }: { count: number; onPress: () => void; label?: string }) {
  const { t } = useTranslation("common");
  const name = label ?? t("filters");
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const active = count > 0;
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={active ? `${name} (${count})` : name}
      style={({ pressed }) => [st.filterBtn, active && st.filterBtnActive, pressed && st.pressed]}
    >
      <Feather name="sliders" size={18} color={active ? theme.colors.brand.light : theme.colors.text.secondary} />
      {active && (
        <View style={st.badge}>
          <Text style={st.badgeText}>{count}</Text>
        </View>
      )}
    </Pressable>
  );
}

const makeStyles = (t: AppTheme) => StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.screenPadding,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  filterBtn: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: t.colors.border.strong,
    backgroundColor: t.colors.surface.s2,
  },
  filterBtnActive: { borderColor: t.colors.border.focus, backgroundColor: t.colors.brand.soft },
  pressed: { opacity: 0.75, transform: [{ scale: 0.96 }] },
  badge: {
    position: "absolute",
    top: -3,
    right: -3,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.brand.violet,
  },
  badgeText: { color: t.colors.cta.brandFg, fontSize: 10, fontFamily: FONT_FAMILY.extrabold },
});
