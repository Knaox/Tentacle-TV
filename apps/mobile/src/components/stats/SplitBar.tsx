import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { ViewingStatsSplit } from "@tentacle-tv/shared";
import { FONT_FAMILY, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import { useStatsFormat } from "./useStatsFormat";

/**
 * Trois natures, trois couleurs, dans un ordre FIXE : la marque, l'accent,
 * l'ambre — la palette validée par le script du skill dataviz (contraste et
 * écart daltonien) en sombre comme en clair, la même qu'au web.
 */
export const ANIME_COLOR = "#D97706";

type SplitKey = "movies" | "series" | "anime";

/**
 * La part de chaque nature dans le temps de la période : une barre empilée
 * à 100 %, segments séparés par 2 px de fond, et la légende qui porte les
 * valeurs — l'identité ne repose jamais sur la couleur seule.
 */
export const SplitBar = memo(function SplitBar({ split }: { split: ViewingStatsSplit }) {
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const f = useStatsFormat();
  const colors: Record<SplitKey, string> = { movies: theme.colors.brand.violet, series: theme.colors.brand.accent, anime: ANIME_COLOR };
  const parts = ([
    { key: "movies", seconds: split.movieSeconds },
    { key: "series", seconds: split.seriesSeconds },
    { key: "anime", seconds: split.animeSeconds },
  ] as Array<{ key: SplitKey; seconds: number }>).filter((p) => p.seconds > 0);
  const total = parts.reduce((n, p) => n + p.seconds, 0);
  if (total <= 0) return null;

  return (
    <View>
      <View
        style={st.bar}
        accessible
        accessibilityLabel={parts.map((p) => `${f.t(`split_${p.key}`)} ${f.percent(p.seconds / total)}`).join(", ")}
      >
        {parts.map((p) => <View key={p.key} style={{ flex: p.seconds, backgroundColor: colors[p.key] }} />)}
      </View>
      <View style={st.legend} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {parts.map((p) => (
          <View key={p.key} style={st.legendItem}>
            <View style={[st.swatch, { backgroundColor: colors[p.key] }]} />
            <Text style={st.legendLabel}>{f.t(`split_${p.key}`)}</Text>
            <Text style={st.legendValue}>{f.percent(p.seconds / total)}</Text>
            <Text style={st.legendSecondary}>{f.duration(p.seconds)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    bar: { flexDirection: "row", height: 14, gap: 2, borderRadius: 4, overflow: "hidden" },
    legend: { flexDirection: "row", flexWrap: "wrap", columnGap: 16, rowGap: 8, marginTop: 12 },
    legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
    swatch: { width: 10, height: 10, borderRadius: 3 },
    legendLabel: { fontSize: 14, fontFamily: FONT_FAMILY.regular, color: t.colors.text.secondary },
    legendValue: { fontSize: 14, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.primary },
    legendSecondary: { fontSize: 12, fontFamily: FONT_FAMILY.regular, color: t.colors.text.tertiary },
  });
