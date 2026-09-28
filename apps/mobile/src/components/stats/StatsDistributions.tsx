import { memo } from "react";
import { View } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { ViewingStats, ViewingStatsDevice } from "@tentacle-tv/shared";
import { spacing, useTheme } from "@/theme";
import { HBarList } from "./HBarList";
import { SplitBar } from "./SplitBar";
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

/** Films, séries, animés — puis langues originales et décennies. */
export const MixBlocks = memo(function MixBlocks({ stats }: { stats: ViewingStats }) {
  const f = useStatsFormat();
  const total = stats.totals.seconds;
  const hasSplit = stats.split.movieSeconds + stats.split.seriesSeconds + stats.split.animeSeconds > 0;
  return (
    <View style={{ gap: spacing.lg }}>
      {hasSplit && (
        <StatsBlock title={f.t("splitTitle")}>
          <SplitBar split={stats.split} />
        </StatsBlock>
      )}
      {stats.languages.length > 0 && (
        <StatsBlock title={f.t("languagesTitle")}>
          <HBarList
            max={1}
            items={stats.languages.map((l) => ({ key: l.key, label: l.label, value: l.share, display: f.percent(l.share), secondary: f.duration(l.seconds) }))}
          />
        </StatsBlock>
      )}
      {stats.decades.length > 0 && (
        <StatsBlock title={f.t("decadesTitle")}>
          <HBarList
            items={stats.decades.map((d) => ({
              key: String(d.decade),
              label: f.t("decadeLabel", { decade: d.decade }),
              value: d.seconds,
              display: f.duration(d.seconds),
              secondary: total > 0 ? f.percent(d.seconds / total) : undefined,
            }))}
          />
        </StatsBlock>
      )}
    </View>
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
