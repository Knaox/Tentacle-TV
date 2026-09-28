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
}

/**
 * Le chiffre qui ouvre l'écran — UN seul, en très grand : le temps passé
 * devant l'écran sur la période, sa traduction en journées (ou en longs
 * métrages), et d'où il vient (mesuré, estimé). Le choix de la période est
 * juste au-dessus : il règle tout ce qui suit.
 */
export const StatsHeroFigure = memo(function StatsHeroFigure({ stats, period, onPeriodChange, pending }: Props) {
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

  return (
    <View style={st.card}>
      <SegmentedChoice
        accessibilityLabel={f.t("periodGroup")}
        value={period}
        onChange={(v) => onPeriodChange(v as ViewingStatsPeriod)}
        options={VIEWING_STATS_PERIODS.map((p) => ({ value: p, label: f.t(`period_${p}`) }))}
      />
      <View style={[st.body, pending && st.pending]} accessible accessibilityLabel={`${f.t(`heroLead_${period}`)} ${figure.value} ${unit}`}>
        <Text style={st.lead}>{f.t(`heroLead_${period}`)}</Text>
        <View style={st.figureRow}>
          <Text style={[st.figure, { color: theme.colors.brand.light }]}>{figure.value}</Text>
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
  );
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    card: {
      gap: spacing.md,
      padding: spacing.lg,
      borderRadius: RADIUS.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border.subtle,
      backgroundColor: t.colors.surface.s1,
    },
    body: { gap: 2 },
    pending: { opacity: 0.6 },
    lead: { fontSize: 14, fontFamily: FONT_FAMILY.medium, color: t.colors.text.secondary },
    figureRow: { flexDirection: "row", alignItems: "baseline", gap: 10 },
    figure: { fontSize: 60, lineHeight: 66, fontFamily: FONT_FAMILY.extrabold, letterSpacing: -1.5 },
    unit: { fontSize: 26, fontFamily: FONT_FAMILY.bold, color: t.colors.text.primary },
    equivalence: { fontSize: 15, lineHeight: 21, fontFamily: FONT_FAMILY.regular, color: t.colors.text.secondary },
    sourceRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    source: { flex: 1, fontSize: 12, fontFamily: FONT_FAMILY.regular, color: t.colors.text.tertiary },
    little: { fontSize: 14, lineHeight: 20, fontFamily: FONT_FAMILY.regular, color: t.colors.text.secondary },
  });
