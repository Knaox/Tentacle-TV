import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { ViewingStatsTotals } from "@tentacle-tv/shared";
import { FONT_FAMILY, RADIUS, spacing, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import { useStatsFormat } from "./useStatsFormat";

type FeatherName = keyof typeof Feather.glyphMap;

const Tile = memo(function Tile({ icon, value, label, wide }: { icon: FeatherName; value: string; label: string; wide: boolean }) {
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  return (
    <View style={[st.tile, { flexBasis: wide ? "23%" : "47%" }]} accessible accessibilityLabel={`${value} ${label}`}>
      <View style={[st.icon, { backgroundColor: theme.colors.brand.ghost }]}>
        <Feather name={icon} size={17} color={theme.colors.brand.light} />
      </View>
      <View style={st.texts}>
        <Text style={st.value}>{value}</Text>
        <Text style={st.label}>{label}</Text>
      </View>
    </View>
  );
});

/**
 * Les comptes de la période, en quatre tuiles : films et épisodes vus
 * (exacts, lus de Jellyfin), séries regardées, jours de visionnage. Deux par
 * rangée au téléphone, quatre sur une tablette.
 */
export const StatsKpis = memo(function StatsKpis({ totals, wide }: { totals: ViewingStatsTotals; wide: boolean }) {
  const st = useThemedStyles(makeStyles);
  const f = useStatsFormat();
  return (
    <View style={st.grid}>
      <Tile wide={wide} icon="film" value={f.number(totals.movies)} label={f.t("kpiMovies", { count: totals.movies })} />
      <Tile wide={wide} icon="tv" value={f.number(totals.episodes)} label={f.t("kpiEpisodes", { count: totals.episodes })} />
      <Tile wide={wide} icon="layers" value={f.number(totals.series)} label={f.t("kpiSeries", { count: totals.series })} />
      <Tile wide={wide} icon="calendar" value={f.number(totals.activeDays)} label={f.t("kpiDays", { count: totals.activeDays })} />
    </View>
  );
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: spacing.sm },
    tile: {
      flexGrow: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      minHeight: 68,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      marginHorizontal: 2,
      borderRadius: RADIUS.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border.subtle,
      backgroundColor: t.colors.surface.s1,
    },
    icon: { width: 36, height: 36, borderRadius: RADIUS.lg, alignItems: "center", justifyContent: "center" },
    texts: { flex: 1, minWidth: 0 },
    value: { fontSize: 22, fontFamily: FONT_FAMILY.bold, color: t.colors.text.primary },
    label: { marginTop: 2, fontSize: 12, lineHeight: 15, fontFamily: FONT_FAMILY.medium, color: t.colors.text.tertiary },
  });
