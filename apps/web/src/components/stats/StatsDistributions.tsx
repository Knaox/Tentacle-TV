import { memo } from "react";
import { AppWindow, Globe, Monitor, Smartphone, Tv, type LucideIcon } from "lucide-react";
import type { ViewingStats, ViewingStatsDevice } from "@tentacle-tv/shared";
import { HBarList } from "./HBarList";
import { SplitBar } from "./SplitBar";
import { StatsSection } from "./StatsSection";
import { useStatsFormat } from "./useStatsFormat";

const DEVICE_ICONS: Record<ViewingStatsDevice, LucideIcon> = {
  tv: Tv,
  webos: Tv,
  mobile: Smartphone,
  desktop: Monitor,
  web: Globe,
  other: AppWindow,
};

/** Vos genres — la part du temps de la période, un titre comptant dans chacun de ses genres. */
export const GenresCard = memo(function GenresCard({ stats }: { stats: ViewingStats }) {
  const f = useStatsFormat();
  if (stats.genres.length === 0) return null;
  return (
    <StatsSection title={f.t("genresTitle")} hint={f.t("genresNote")}>
      <HBarList
        ariaLabel={f.t("genresTitle")}
        max={1}
        items={stats.genres.map((g) => ({
          key: g.key, label: g.label, value: g.share, display: f.percent(g.share), secondary: f.duration(g.seconds),
        }))}
      />
    </StatsSection>
  );
});

/** Films, séries, animés — puis langues originales et décennies, sur la même colonne. */
export const MixCard = memo(function MixCard({ stats }: { stats: ViewingStats }) {
  const f = useStatsFormat();
  const total = stats.totals.seconds;
  const hasSplit = stats.split.movieSeconds + stats.split.seriesSeconds + stats.split.animeSeconds > 0;
  return (
    <div className="flex flex-col gap-4">
      {hasSplit && (
        <StatsSection title={f.t("splitTitle")}>
          <SplitBar split={stats.split} />
        </StatsSection>
      )}
      {stats.languages.length > 0 && (
        <StatsSection title={f.t("languagesTitle")}>
          <HBarList
            ariaLabel={f.t("languagesTitle")}
            max={1}
            items={stats.languages.map((l) => ({
              key: l.key, label: l.label, value: l.share, display: f.percent(l.share), secondary: f.duration(l.seconds),
            }))}
          />
        </StatsSection>
      )}
      {stats.decades.length > 0 && (
        <StatsSection title={f.t("decadesTitle")}>
          <HBarList
            ariaLabel={f.t("decadesTitle")}
            items={stats.decades.map((d) => ({
              key: String(d.decade),
              label: f.t("decadeLabel", { decade: d.decade }),
              value: d.seconds,
              display: f.duration(d.seconds),
              secondary: total > 0 ? f.percent(d.seconds / total) : undefined,
            }))}
          />
        </StatsSection>
      )}
    </div>
  );
});

/** Vos écrans — le temps MESURÉ, par application. */
export const DevicesCard = memo(function DevicesCard({ stats }: { stats: ViewingStats }) {
  const f = useStatsFormat();
  const total = stats.devices.reduce((n, d) => n + d.seconds, 0);
  if (total <= 0) return null;
  return (
    <StatsSection title={f.t("devicesTitle")} hint={f.t("devicesHint")}>
      <HBarList
        ariaLabel={f.t("devicesTitle")}
        items={stats.devices.map((d) => {
          const Icon = DEVICE_ICONS[d.device];
          return {
            key: `${d.device}|${d.client ?? ""}`,
            label: d.device === "other" && d.client ? d.client : f.t(`device_${d.device}`),
            value: d.seconds,
            display: f.percent(d.seconds / total),
            secondary: f.duration(d.seconds),
            icon: <Icon size={15} />,
          };
        })}
      />
    </StatsSection>
  );
});
