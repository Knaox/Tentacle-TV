import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { ViewingStatsRecords } from "@tentacle-tv/shared";
import { FONT_FAMILY, RADIUS, spacing, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import { StatsBlock } from "./StatsBlock";
import { useStatsFormat } from "./useStatsFormat";

interface RecordCard {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string;
  detail: string;
}

/**
 * Vos records de la période : la journée la plus remplie, la plus longue
 * suite de jours (un quart d'heure par jour au moins), le marathon (le plus
 * de TEMPS sur une série en un jour) et la plus longue séance. Un record
 * absent n'a pas de place ; aucun, pas de section.
 */
export const RecordsBlock = memo(function RecordsBlock({ records, wide }: { records: ViewingStatsRecords; wide: boolean }) {
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const f = useStatsFormat();
  const cards: RecordCard[] = [];
  const { biggestDay, longestStreak, binge, longestSession } = records;
  if (biggestDay && biggestDay.seconds >= 60) {
    cards.push({ icon: "award", label: f.t("record_biggestDay"), value: f.duration(biggestDay.seconds), detail: f.day(biggestDay.date, true) });
  }
  if (longestStreak && longestStreak.days >= 2) {
    cards.push({
      icon: "calendar",
      label: f.t("record_longestStreak"),
      value: f.t("recordDetail_longestStreak", { count: longestStreak.days }),
      detail: `${f.day(longestStreak.from)} → ${f.day(longestStreak.to, true)}`,
    });
  }
  if (binge && binge.seconds > 0) {
    cards.push({
      icon: "zap",
      label: f.t("record_binge"),
      value: f.duration(binge.seconds),
      detail: f.t("recordBingeDetail", { series: binge.seriesName, episodes: binge.episodes, date: f.day(binge.date, true) }),
    });
  }
  if (longestSession && longestSession.seconds >= 60) {
    cards.push({
      icon: "coffee",
      label: f.t("record_longestSession"),
      value: f.duration(longestSession.seconds),
      detail: f.t("recordSessionDetail", { title: longestSession.title, date: f.day(longestSession.date, true) }),
    });
  }
  if (cards.length === 0) return null;

  return (
    <StatsBlock title={f.t("recordsTitle")}>
      <View style={st.grid}>
        {cards.map((c) => (
          <View key={c.label} style={[st.card, { flexBasis: wide ? "47%" : "100%" }]} accessible accessibilityLabel={`${c.label} : ${c.value}. ${c.detail}`}>
            <View style={st.icon}>
              <Feather name={c.icon} size={17} color={theme.colors.brand.light} />
            </View>
            <View style={st.texts}>
              <Text style={st.label}>{c.label}</Text>
              <Text style={st.value}>{c.value}</Text>
              <Text style={st.detail}>{c.detail}</Text>
            </View>
          </View>
        ))}
      </View>
    </StatsBlock>
  );
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: spacing.lg },
    card: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
    icon: { width: 36, height: 36, borderRadius: RADIUS.lg, alignItems: "center", justifyContent: "center", backgroundColor: t.colors.fill.soft },
    texts: { flex: 1, minWidth: 0 },
    label: { fontSize: 12, fontFamily: FONT_FAMILY.medium, color: t.colors.text.tertiary },
    value: { marginTop: 2, fontSize: 19, fontFamily: FONT_FAMILY.bold, color: t.colors.text.primary },
    detail: { marginTop: 2, fontSize: 13, lineHeight: 18, fontFamily: FONT_FAMILY.regular, color: t.colors.text.secondary },
  });
