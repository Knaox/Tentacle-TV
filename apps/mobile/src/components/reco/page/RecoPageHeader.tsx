import { View, Text, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { IconButton } from "@/components/ui";
import { spacing, typography, FONT_FAMILY, useTheme, useThemedStyles, type AppTheme } from "@/theme";

interface Props {
  /** Sans carrousel, le titre de la page tient sa place. */
  showTitle: boolean;
  /** Familles de plateformes actives (le compteur du bouton Filtres). */
  filterCount?: number;
  /** Absent : pas de bouton Filtres. */
  onOpenFilters?: () => void;
}

/** Le haut de la page Pour vous : titre compact (ou rien, sous le carrousel) et Filtres. */
export function RecoPageHeader({ showTitle, filterCount = 0, onOpenFilters }: Props) {
  const { t } = useTranslation("reco");
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  if (!showTitle && !onOpenFilters) return null;
  return (
    <View style={[st.row, !showTitle && st.rowCompact]}>
      {showTitle ? <Text style={st.title}>{t("pageTitle")}</Text> : <View style={st.spacer} />}
      {onOpenFilters && (
        <View style={st.filters}>
          <IconButton
            icon="sliders"
            size={44}
            onPress={onOpenFilters}
            accessibilityLabel={filterCount > 0 ? `${t("filtersButton")}, ${filterCount}` : t("filtersButton")}
            color={filterCount > 0 ? theme.colors.brand.light : theme.colors.text.primary}
            bgColor={filterCount > 0 ? theme.colors.brand.soft : theme.colors.fill.subtle}
          />
          {filterCount > 0 && (
            <View style={st.count} pointerEvents="none">
              <Text style={st.countTxt}>{filterCount}</Text>
            </View>
          )}
          <Feather name="chevron-down" size={0} color="transparent" />
        </View>
      )}
    </View>
  );
}

const makeStyles = (t: AppTheme) => StyleSheet.create({
  row: {
    flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const,
    paddingHorizontal: spacing.screenPadding, paddingTop: spacing.lg, gap: spacing.md,
  },
  rowCompact: { paddingTop: spacing.md },
  spacer: { flex: 1 },
  title: { ...typography.title, fontFamily: FONT_FAMILY.extrabold, color: t.colors.text.primary, letterSpacing: -0.5, flex: 1 },
  filters: { position: "relative" as const },
  count: {
    position: "absolute" as const, top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9,
    paddingHorizontal: 5, alignItems: "center" as const, justifyContent: "center" as const,
    backgroundColor: t.colors.brand.violet,
  },
  countTxt: { fontSize: 10, fontFamily: FONT_FAMILY.bold, color: t.colors.cta.brandFg },
});
