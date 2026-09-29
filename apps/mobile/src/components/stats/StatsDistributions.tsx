import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { ViewingStats, ViewingStatsDevice } from "@tentacle-tv/shared";
import { FONT_FAMILY, spacing, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import { HBarList } from "./HBarList";
import { StatsBlock } from "./StatsBlock";
import { useStatsFormat } from "./useStatsFormat";

const DEVICE_ICONS: Record<ViewingStatsDevice, keyof typeof Feather.glyphMap> = {
  tv: "tv",
  webos: "tv",
  mobile: "smartphone",
  desktop: "monitor",
  web: "globe",
  other: "box",
};

/** Vos genres — la part du temps, un titre comptant dans chacun de ses genres. */
export const GenresBlock = memo(function GenresBlock({ stats }: { stats: ViewingStats }) {
  const f = useStatsFormat();
  if (stats.genres.length === 0) return null;
  return (
    <StatsBlock title={f.t("genresTitle")} hint={f.t("genresNote")}>
      <HBarList
        max={1}
        items={stats.genres.map((g) => ({ key: g.key, label: g.label, value: g.share, display: f.percent(g.share), secondary: f.duration(g.seconds) }))}
      />
    </StatsBlock>
  );
});

/**
 * Films, séries, animés — trois natures qui ne se recouvrent pas, en part du
 * temps : une barre chacune, d'une seule teinte — puis les décennies, sur la
 * même carte.
 */
export const MixBlock = memo(function MixBlock({ stats }: { stats: ViewingStats }) {
  const st = useThemedStyles(makeStyles);
  const f = useStatsFormat();
  const total = stats.totals.seconds;
  const { movieSeconds, seriesSeconds, animeSeconds } = stats.split;
  const splitTotal = movieSeconds + seriesSeconds + animeSeconds;
  const split = [
    { key: "movies", seconds: movieSeconds },
    { key: "series", seconds: seriesSeconds },
    { key: "anime", seconds: animeSeconds },
  ].filter((p) => p.seconds > 0);
  if (split.length === 0 && stats.decades.length === 0) return null;
  return (
    <StatsBlock title={f.t("splitTitle")}>
      {split.length > 0 ? (
        <HBarList
          max={1}
          items={split.map((p) => ({
            key: p.key,
            label: f.t(`split_${p.key}`),
            value: p.seconds / splitTotal,
            display: f.percent(p.seconds / splitTotal),
            secondary: f.duration(p.seconds),
          }))}
        />
      ) : null}
      {stats.decades.length > 0 ? (
        <View style={split.length > 0 ? st.divided : undefined}>
          <Text style={st.sub}>{f.t("decadesTitle")}</Text>
          <HBarList
            items={stats.decades.map((d) => ({
              key: String(d.decade),
              label: f.t("decadeLabel", { decade: d.decade }),
              value: d.seconds,
              display: f.duration(d.seconds),
              secondary: total > 0 ? f.percent(d.seconds / total) : undefined,
            }))}
          />
        </View>
      ) : null}
    </StatsBlock>
  );
});

/** Vos écrans — le temps MESURÉ, par application. */
export const DevicesBlock = memo(function DevicesBlock({ stats }: { stats: ViewingStats }) {
  const theme = useTheme();
  const f = useStatsFormat();
  const total = stats.devices.reduce((n, d) => n + d.seconds, 0);
  if (total <= 0) return null;
  return (
    <StatsBlock title={f.t("devicesTitle")} hint={f.t("devicesHint")}>
      <HBarList
        items={stats.devices.map((d) => ({
          key: `${d.device}|${d.client ?? ""}`,
          label: d.device === "other" && d.client ? d.client : f.t(`device_${d.device}`),
          value: d.seconds,
          display: f.percent(d.seconds / total),
          secondary: f.duration(d.seconds),
          icon: <Feather name={DEVICE_ICONS[d.device]} size={14} color={theme.colors.text.tertiary} />,
        }))}
      />
    </StatsBlock>
  );
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    divided: { marginTop: spacing.xl, paddingTop: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderColor: t.colors.border.subtle },
    sub: { marginBottom: spacing.md, fontSize: 13, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.secondary },
  });
