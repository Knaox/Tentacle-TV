import { memo, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View, type GestureResponderEvent } from "react-native";
import { analyzeRhythm, heatLevel, HEAT_LEVELS, RHYTHM_HOURS } from "@tentacle-tv/shared";
import { FONT_FAMILY, useTheme, useThemedStyles, withAlpha, type AppTheme } from "@/theme";
import { useStatsFormat } from "./useStatsFormat";

const LABEL_W = 30;
const GAP = 2;
/** Rampe séquentielle d'une seule teinte : la marque, du plus discret au plein. */
const LEVEL_ALPHA = [0, 0.24, 0.46, 0.7, 1];

/**
 * « Quand regardez-vous ? » — la grille jour × heure du temps MESURÉ, en
 * quatre niveaux d'une seule teinte, séparés par 2 px de fond. La phrase du
 * haut dit l'essentiel ; toucher une case l'écrit en clair (la plus forte y
 * est d'emblée). Le lecteur d'écran entend le résumé, pas 168 cases.
 */
export const RhythmHeatmap = memo(function RhythmHeatmap({ grid }: { grid: number[] }) {
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const f = useStatsFormat();
  const [width, setWidth] = useState(0);
  const insight = useMemo(() => analyzeRhythm(grid), [grid]);
  const max = useMemo(() => Math.max(0, ...grid), [grid]);
  const [picked, setPicked] = useState<number | null>(null);

  if (insight.totalSeconds <= 0) return <Text style={st.empty}>{f.t("rhythmEmpty")}</Text>;

  const colorOf = (level: number) =>
    level === 0 ? theme.colors.fill.soft : withAlpha(theme.colors.brand.violet, LEVEL_ALPHA[level], theme.colors.brand.violet);
  const cell = width > 0 ? (width - LABEL_W - GAP * RHYTHM_HOURS) / RHYTHM_HOURS : 0;
  const active = picked ?? grid.indexOf(max);
  const day = Math.floor(active / RHYTHM_HOURS);
  const hour = active % RHYTHM_HOURS;
  const headline =
    insight.topWeekday !== null && insight.topHour !== null
      ? f.t("rhythmInsight", { weekday: f.weekday(insight.topWeekday), hour: insight.topHour })
      : "";
  const daypart = insight.topDaypart ? f.t("rhythmDaypart", { daypart: f.t(`daypart_${insight.topDaypart}`) }) : "";
  const readout = `${f.t("rhythmSlot", { weekday: f.weekday(day), from: hour, to: hour + 1 })} · ${grid[active] > 0 ? f.duration(grid[active]) : f.t("noViewing")}`;

  const onPress = (e: GestureResponderEvent) => {
    const col = Math.floor((e.nativeEvent.locationX - LABEL_W) / (cell + GAP));
    const row = Math.floor(e.nativeEvent.locationY / (cell + GAP));
    if (col >= 0 && col < RHYTHM_HOURS && row >= 0 && row < 7) setPicked(row * RHYTHM_HOURS + col);
  };

  return (
    <View>
      <Text style={st.headline}>{headline}</Text>
      {daypart ? <Text style={st.daypart}>{daypart}</Text> : null}
      <Text style={st.readout} accessibilityElementsHidden importantForAccessibility="no">{readout}</Text>
      <Pressable
        onPress={onPress}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        accessible
        accessibilityRole="image"
        accessibilityLabel={`${headline}. ${daypart}`}
        style={st.grid}
      >
        {cell > 0 &&
          Array.from({ length: 7 }, (_, d) => (
            <View key={d} style={[st.row, { height: cell, marginBottom: GAP }]}>
              <Text style={[st.dayLabel, { width: LABEL_W }]}>{f.weekdayShort(d)}</Text>
              {Array.from({ length: RHYTHM_HOURS }, (_, h) => {
                const i = d * RHYTHM_HOURS + h;
                return (
                  <View
                    key={h}
                    style={{
                      width: cell,
                      height: cell,
                      marginRight: GAP,
                      borderRadius: 3,
                      backgroundColor: colorOf(heatLevel(grid[i], max)),
                      borderWidth: i === active ? 1.5 : 0,
                      borderColor: theme.colors.text.primary,
                    }}
                  />
                );
              })}
            </View>
          ))}
        {cell > 0 && (
          <View style={st.hours}>
            {[0, 6, 12, 18].map((h) => (
              <Text key={h} style={[st.hour, { left: LABEL_W + h * (cell + GAP) }]}>{h}</Text>
            ))}
          </View>
        )}
      </Pressable>
      <View style={st.footer} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Text style={st.legendTxt}>{f.t("rhythmLess")}</Text>
        {Array.from({ length: HEAT_LEVELS + 1 }, (_, level) => (
          <View key={level} style={[st.swatch, { backgroundColor: colorOf(level) }]} />
        ))}
        <Text style={st.legendTxt}>{f.t("rhythmMore")}</Text>
      </View>
      <Text style={st.note}>{f.t("rhythmNote")}</Text>
    </View>
  );
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    empty: { fontSize: 14, lineHeight: 20, fontFamily: FONT_FAMILY.regular, color: t.colors.text.tertiary },
    headline: { fontSize: 16, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.primary },
    daypart: { marginTop: 2, fontSize: 14, fontFamily: FONT_FAMILY.regular, color: t.colors.text.tertiary },
    readout: { marginTop: 10, fontSize: 13, fontFamily: FONT_FAMILY.medium, color: t.colors.text.secondary, fontVariant: ["tabular-nums"] },
    grid: { marginTop: 8, paddingBottom: 16 },
    row: { flexDirection: "row", alignItems: "center" },
    dayLabel: { fontSize: 10, fontFamily: FONT_FAMILY.medium, color: t.colors.text.tertiary },
    hours: { position: "absolute", left: 0, right: 0, bottom: 0, height: 14 },
    hour: { position: "absolute", fontSize: 10, fontFamily: FONT_FAMILY.regular, color: t.colors.text.tertiary },
    footer: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6 },
    swatch: { width: 11, height: 11, borderRadius: 3 },
    legendTxt: { fontSize: 11, fontFamily: FONT_FAMILY.regular, color: t.colors.text.tertiary },
    note: { marginTop: 6, fontSize: 11, lineHeight: 16, fontFamily: FONT_FAMILY.regular, color: t.colors.text.tertiary },
  });
