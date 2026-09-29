import { memo, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View, type AccessibilityActionEvent, type GestureResponderEvent } from "react-native";
import Svg, { G, Line, Path, Text as SvgText } from "react-native-svg";
import { niceAxis, type ViewingStatsTimeline } from "@tentacle-tv/shared";
import { FONT_FAMILY, useTheme, useThemedStyles, withAlpha, type AppTheme } from "@/theme";
import { useStatsFormat } from "./useStatsFormat";

const PLOT_H = 150;
const TOP = 14;
const AXIS_H = 22;
const LEFT = 34;
const RIGHT = 4;
const LABEL_SPACING = 26;

/** Une colonne : carrée à la base, 4 px arrondis au bout de la donnée seulement. */
function columnPath(x: number, w: number, yTop: number, yBottom: number, rounded: boolean): string {
  const h = yBottom - yTop;
  const r = rounded ? Math.min(4, h, w / 2) : 0;
  if (r <= 0) return `M${x},${yBottom}V${yTop}H${x + w}V${yBottom}Z`;
  return `M${x},${yBottom}V${yTop + r}Q${x},${yTop} ${x + r},${yTop}H${x + w - r}Q${x + w},${yTop} ${x + w},${yTop + r}V${yBottom}Z`;
}

/**
 * La frise d'activité : colonnes (heures par jour, mois ou année), le mesuré
 * à la base, l'estimé posé dessus, séparés par 2 px de fond. Toucher une
 * colonne l'écrit en clair au-dessus du graphique (le plus haut pas y est
 * d'emblée) ; au lecteur d'écran, le graphique est un réglage qu'on fait
 * défiler d'un pas à l'autre.
 */
export const ActivityChart = memo(function ActivityChart({ timeline }: { timeline: ViewingStatsTimeline }) {
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const f = useStatsFormat();
  const [width, setWidth] = useState(0);
  const { buckets, unit } = timeline;
  const n = buckets.length;

  const model = useMemo(() => {
    const totals = buckets.map((b) => b.measuredSeconds + b.estimatedSeconds);
    const maxSeconds = Math.max(0, ...totals);
    return {
      totals,
      axis: niceAxis(maxSeconds / 3600),
      peak: maxSeconds > 0 ? totals.indexOf(maxSeconds) : n - 1,
      both: buckets.some((b) => b.measuredSeconds > 0) && buckets.some((b) => b.estimatedSeconds > 0),
    };
  }, [buckets, n]);
  const [picked, setPicked] = useState<number | null>(null);
  const active = picked ?? model.peak;

  const measured = theme.colors.brand.violet;
  // Même teinte, plus pâle : l'estimé est un degré de certitude, pas une autre série (cf. le web).
  const estimated = withAlpha(theme.colors.brand.violet, 0.55, theme.colors.brand.violet);
  const plotW = Math.max(0, width - LEFT - RIGHT);
  const band = n > 0 ? plotW / n : 0;
  const barW = Math.min(22, Math.max(3, band * 0.62));
  const yOf = (seconds: number) => TOP + PLOT_H - (seconds / 3600 / model.axis.max) * PLOT_H;
  const labelEvery = Math.max(1, Math.ceil(LABEL_SPACING / Math.max(band, 1)));

  const bucket = buckets[active];
  const total = model.totals[active] ?? 0;
  const readout = bucket
    ? `${f.bucket(unit, bucket.key)} · ${total > 0 ? f.duration(total) : f.t("noViewing")}`
    : "";
  const detail = bucket && model.both && total > 0
    ? `${f.t("legendMeasured")} ${f.duration(bucket.measuredSeconds)} · ${f.t("legendEstimated")} ${f.duration(bucket.estimatedSeconds)}`
    : null;

  const onPress = (e: GestureResponderEvent) => {
    const i = Math.floor((e.nativeEvent.locationX - LEFT) / band);
    if (i >= 0 && i < n) setPicked(i);
  };
  const onAction = (e: AccessibilityActionEvent) => {
    const step = e.nativeEvent.actionName === "increment" ? 1 : e.nativeEvent.actionName === "decrement" ? -1 : 0;
    if (step) setPicked(Math.max(0, Math.min(n - 1, active + step)));
  };

  return (
    <View>
      {model.both && (
        <View style={st.legend} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View style={[st.swatch, { backgroundColor: measured }]} />
          <Text style={st.legendTxt}>{f.t("legendMeasured")}</Text>
          <View style={[st.swatch, { backgroundColor: estimated }]} />
          <Text style={st.legendTxt}>{f.t("legendEstimated")}</Text>
        </View>
      )}
      <Text style={st.readout}>{readout}</Text>
      {detail ? <Text style={st.detail}>{detail}</Text> : null}
      <Pressable
        onPress={onPress}
        onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={f.t(`activityHint_${unit}`)}
        accessibilityValue={{ text: detail ? `${readout}. ${detail}` : readout }}
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={onAction}
        style={st.plot}
      >
        {width > 0 && (
          <Svg width={width} height={TOP + PLOT_H + AXIS_H}>
            {model.axis.ticks.map((tick) => {
              const y = TOP + PLOT_H - (tick / model.axis.max) * PLOT_H;
              return (
                <Line key={`g${tick}`} x1={LEFT} x2={width - RIGHT} y1={y} y2={y} stroke={theme.colors.border.subtle} strokeWidth={1} />
              );
            })}
            {model.axis.ticks.map((tick) => (
              <SvgText
                key={`t${tick}`}
                x={LEFT - 6}
                y={TOP + PLOT_H - (tick / model.axis.max) * PLOT_H + 3.5}
                fontSize={10}
                fontFamily={FONT_FAMILY.regular}
                fill={theme.colors.text.tertiary}
                textAnchor="end"
              >
                {`${f.number(tick, tick % 1 === 0 ? 0 : 1)} h`}
              </SvgText>
            ))}
            {buckets.map((b, i) => {
              const x = LEFT + band * i + (band - barW) / 2;
              const base = TOP + PLOT_H;
              const mTop = yOf(b.measuredSeconds);
              const both = b.measuredSeconds > 0 && b.estimatedSeconds > 0;
              const eBottom = both ? mTop - 2 : base;
              const eTop = eBottom - (b.estimatedSeconds / 3600 / model.axis.max) * PLOT_H;
              const isActive = i === active;
              return (
                <G key={b.key}>
                  {b.measuredSeconds > 0 && (
                    <Path d={columnPath(x, barW, mTop, base, !both)} fill={isActive ? theme.colors.brand.light : measured} />
                  )}
                  {b.estimatedSeconds > 0 && eTop < eBottom && (
                    <Path d={columnPath(x, barW, eTop, eBottom, true)} fill={estimated} />
                  )}
                  {(i === n - 1 || (n - 1 - i) % labelEvery === 0) && (
                    <SvgText
                      x={LEFT + band * (i + 0.5)}
                      y={TOP + PLOT_H + 15}
                      fontSize={10}
                      fontFamily={FONT_FAMILY.regular}
                      fill={isActive ? theme.colors.text.primary : theme.colors.text.tertiary}
                      textAnchor="middle"
                    >
                      {f.tick(unit, b.key)}
                    </SvgText>
                  )}
                </G>
              );
            })}
          </Svg>
        )}
      </Pressable>
      {timeline.undatedSeconds > 0 && (
        <Text style={st.note}>{f.t("activityUndated", { duration: f.duration(timeline.undatedSeconds) })}</Text>
      )}
    </View>
  );
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    legend: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
    swatch: { width: 10, height: 10, borderRadius: 3, marginLeft: 4 },
    legendTxt: { fontSize: 12, fontFamily: FONT_FAMILY.regular, color: t.colors.text.secondary, marginRight: 6 },
    readout: { fontSize: 15, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.primary, fontVariant: ["tabular-nums"] },
    detail: { marginTop: 2, fontSize: 12, fontFamily: FONT_FAMILY.regular, color: t.colors.text.tertiary },
    plot: { marginTop: 8 },
    note: { marginTop: 8, fontSize: 12, lineHeight: 17, fontFamily: FONT_FAMILY.regular, color: t.colors.text.tertiary },
  });
