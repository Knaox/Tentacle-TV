import { memo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { ViewingStats } from "@tentacle-tv/shared";
import { FONT_FAMILY, RADIUS, spacing, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import { useStatsFormat } from "./useStatsFormat";

/**
 * « À propos de ces chiffres » — d'où vient chaque nombre, dit simplement :
 * la mesure et sa date de départ, l'estimation d'avant, les comptes Jellyfin,
 * le fuseau appliqué, la date du profil de goût. Replié par défaut.
 */
export const StatsAbout = memo(function StatsAbout({ stats }: { stats: ViewingStats }) {
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const f = useStatsFormat();
  const [open, setOpen] = useState(false);
  const since = stats.measuredSince ? f.isoDay(stats.measuredSince, true) : null;
  const lines = [
    since ? f.t("aboutMeasured", { date: since }) : null,
    since ? f.t("aboutEstimated") : f.t("aboutNoMeasure"),
    f.t("aboutCounts"),
    f.t("aboutTimeZone", { timeZone: stats.timeZone }),
    f.t("aboutOrigins"),
    stats.listening.since ? f.t("aboutListening", { date: f.isoDay(stats.listening.since, true) }) : null,
    f.t("aboutRecords"),
    stats.taste.computedAt ? f.t("aboutTaste", { date: f.isoDay(stats.taste.computedAt, true) }) : null,
  ].filter((l): l is string => !!l);

  return (
    <View style={st.box}>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={st.head}
      >
        <Feather name="info" size={16} color={theme.colors.text.secondary} />
        <Text style={st.title}>{f.t("aboutTitle")}</Text>
        <Feather name={open ? "chevron-up" : "chevron-down"} size={16} color={theme.colors.text.tertiary} />
      </Pressable>
      {open ? (
        <View style={st.lines}>
          {lines.map((line) => <Text key={line} style={st.line}>{line}</Text>)}
        </View>
      ) : null}
    </View>
  );
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    box: {
      borderRadius: RADIUS.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border.subtle,
      backgroundColor: t.colors.fill.faint,
    },
    head: { flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: 48, paddingHorizontal: spacing.lg },
    title: { flex: 1, fontSize: 14, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.secondary },
    lines: { gap: 6, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
    line: { fontSize: 13, lineHeight: 19, fontFamily: FONT_FAMILY.regular, color: t.colors.text.tertiary },
  });
