import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
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
 * suite de jours, le marathon, la plus longue séance. Un record absent n'a
 * pas de carte ; aucun, pas de section.
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
  if (binge) {
    cards.push({
      icon: "zap",
      label: f.t("record_binge"),
      value: f.t("seriesEpisodes", { count: binge.episodes }),
      detail: f.t("recordBingeDetail", { series: binge.seriesName, date: f.day(binge.date, true) }),
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
          <View key={c.label} style={[st.card, { flexBasis: wide ? "48%" : "100%" }]} accessible accessibilityLabel={`${c.label} : ${c.value}. ${c.detail}`}>
            <LinearGradient colors={[theme.colors.brand.light, theme.colors.brand.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={st.icon}>
              <Feather name={c.icon} size={17} color="#FFFFFF" />
            </LinearGradient>
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
    grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: spacing.sm },
    card: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.md,
      padding: spacing.md,
      borderRadius: RADIUS.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border.subtle,
      backgroundColor: t.colors.fill.faint,
    },
    icon: { width: 38, height: 38, borderRadius: RADIUS.lg, alignItems: "center", justifyContent: "center" },
    texts: { flex: 1, minWidth: 0 },
    label: { fontSize: 11, letterSpacing: 0.6, textTransform: "uppercase", fontFamily: FONT_FAMILY.medium, color: t.colors.text.tertiary },
    value: { marginTop: 2, fontSize: 19, fontFamily: FONT_FAMILY.bold, color: t.colors.text.primary },
    detail: { marginTop: 2, fontSize: 13, lineHeight: 18, fontFamily: FONT_FAMILY.regular, color: t.colors.text.secondary },
  });
