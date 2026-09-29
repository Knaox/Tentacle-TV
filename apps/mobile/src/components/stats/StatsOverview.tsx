import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { heroFigure, VIEWING_STATS_PERIODS, type ViewingStats, type ViewingStatsPeriod } from "@tentacle-tv/shared";
import { SegmentedChoice } from "@/components/settings/SegmentedChoice";
import { FONT_FAMILY, RADIUS, spacing, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import { useStatsFormat } from "./useStatsFormat";

/** En dessous : « encore quelques séances », le profil n'est pas encore net. */
const LITTLE_HISTORY_SECONDS = 2 * 3600;

interface Props {
  stats: ViewingStats;
  period: ViewingStatsPeriod;
  onPeriodChange: (period: ViewingStatsPeriod) => void;
  /** Vrai pendant qu'une autre période se charge : l'ancienne reste, estompée. */
  pending: boolean;
  /** Faux sur une période vide : le chiffre et la période restent, pas les compteurs. */
  counters: boolean;
  /** Tablette : les quatre compteurs sur une ligne. */
  wide: boolean;
}

/**
 * La vue d'ensemble, en une carte — celle du web : la période, qui règle tout
 * l'écran ; le temps passé devant l'écran — UN chiffre, à l'encre du texte —,
 * ce qu'il représente et d'où il vient ; puis les quatre comptes, séparés par
 * des filets plutôt qu'empilés en tuiles.
 */
export const StatsOverview = memo(function StatsOverview({ stats, period, onPeriodChange, pending, counters, wide }: Props) {
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const f = useStatsFormat();
  const { totals, measuredSince } = stats;
  const figure = heroFigure(totals.seconds, f.locale);
  const days = Math.floor(totals.seconds / 86_400);
  const movies = Math.floor(totals.seconds / 7_200);
  const equivalence = days >= 1 ? f.t("heroDays", { count: days }) : movies >= 2 ? f.t("heroMovies", { count: movies }) : null;
  const since = measuredSince ? f.isoDay(measuredSince, true) : "";
  const source = totals.measuredSeconds > 0 && totals.estimatedSeconds > 0
    ? f.t("sourceMixed", { date: since })
    : totals.measuredSeconds > 0 ? f.t("sourceMeasured", { date: since }) : f.t("sourceEstimated");
  const unit = f.t(figure.unit === "hours" ? "unitHours" : "unitMinutes", { count: figure.count });
  const items = [
    { key: "movies", value: totals.movies, label: f.t("kpiMovies", { count: totals.movies }) },
    { key: "episodes", value: totals.episodes, label: f.t("kpiEpisodes", { count: totals.episodes }) },
    { key: "series", value: totals.series, label: f.t("kpiSeries", { count: totals.series }) },
    { key: "days", value: totals.activeDays, label: f.t("kpiDays", { count: totals.activeDays }) },
  ];
  const perRow = wide ? 4 : 2;

  return (
    <View style={st.card}>
      <View style={st.top}>
        <SegmentedChoice
          accessibilityLabel={f.t("periodGroup")}
          value={period}
          onChange={(v) => onPeriodChange(v as ViewingStatsPeriod)}
          options={VIEWING_STATS_PERIODS.map((p) => ({ value: p, label: f.t(`period_${p}`) }))}
        />
        <View style={pending && st.pending} accessible accessibilityLabel={`${f.t(`heroLead_${period}`)} ${figure.value} ${unit}`}>
          <Text style={st.lead}>{f.t(`heroLead_${period}`)}</Text>
          <View style={st.figureRow}>
            <Text style={st.figure}>{figure.value}</Text>
            <Text style={st.unit}>{unit}</Text>
          </View>
          {equivalence ? <Text style={st.equivalence}>{equivalence}</Text> : null}
        </View>
        <View style={st.sourceRow}>
          <Feather name="info" size={12} color={theme.colors.text.tertiary} />
          <Text style={st.source}>{source}</Text>
        </View>
        {totals.seconds > 0 && totals.seconds < LITTLE_HISTORY_SECONDS ? <Text style={st.little}>{f.t("littleHistory")}</Text> : null}
      </View>
      {counters ? (
        <View style={[st.counters, pending && st.pending]}>
          {items.map((item, i) => (
            <View
              key={item.key}
              style={[st.cell, { flexBasis: `${100 / perRow}%`, borderLeftWidth: i % perRow ? StyleSheet.hairlineWidth : 0, borderTopWidth: i >= perRow ? StyleSheet.hairlineWidth : 0 }]}
              accessible
              accessibilityLabel={`${f.number(item.value)} ${item.label}`}
            >
              <Text style={st.value}>{f.number(item.value)}</Text>
              <Text style={st.label}>{item.label}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    card: {
      overflow: "hidden",
      borderRadius: RADIUS.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border.subtle,
      backgroundColor: t.colors.surface.s1,
    },
    top: { gap: spacing.md, padding: spacing.lg },
    pending: { opacity: 0.6 },
    lead: { fontSize: 14, fontFamily: FONT_FAMILY.regular, color: t.colors.text.secondary },
    figureRow: { flexDirection: "row", alignItems: "baseline", gap: 10, marginTop: 4 },
    figure: { fontSize: 56, lineHeight: 62, fontFamily: FONT_FAMILY.extrabold, letterSpacing: -1.5, color: t.colors.text.primary },
    unit: { fontSize: 22, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.secondary },
    equivalence: { marginTop: 2, fontSize: 15, lineHeight: 21, fontFamily: FONT_FAMILY.regular, color: t.colors.text.secondary },
    sourceRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    source: { flex: 1, fontSize: 12, lineHeight: 16, fontFamily: FONT_FAMILY.regular, color: t.colors.text.tertiary },
    little: { fontSize: 14, lineHeight: 20, fontFamily: FONT_FAMILY.regular, color: t.colors.text.secondary },
    counters: {
      flexDirection: "row",
      flexWrap: "wrap",
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border.subtle,
    },
    cell: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderColor: t.colors.border.subtle },
    value: { fontSize: 22, fontFamily: FONT_FAMILY.bold, color: t.colors.text.primary },
    label: { marginTop: 2, fontSize: 12, lineHeight: 15, fontFamily: FONT_FAMILY.medium, color: t.colors.text.tertiary },
  });
