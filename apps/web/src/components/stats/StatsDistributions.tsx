import { memo } from "react";
import { AppWindow, Globe, Monitor, Smartphone, Tv, type LucideIcon } from "lucide-react";
import type { ViewingStats, ViewingStatsDevice } from "@tentacle-tv/shared";
import { HBarList } from "./HBarList";
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

/**
 * Films, séries, animés — trois natures qui ne se recouvrent pas, en part du
 * temps : une barre chacune, d'une seule teinte (plus d'aplat tricolore) —
 * puis les décennies, sur la même carte.
 */
export const MixCard = memo(function MixCard({ stats }: { stats: ViewingStats }) {
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
    <StatsSection title={f.t("splitTitle")}>
      {split.length > 0 && (
        <HBarList
          ariaLabel={f.t("splitTitle")}
          max={1}
          items={split.map((p) => ({
            key: p.key,
            label: f.t(`split_${p.key}`),
            value: p.seconds / splitTotal,
            display: f.percent(p.seconds / splitTotal),
            secondary: f.duration(p.seconds),
          }))}
        />
      )}
      {stats.decades.length > 0 && (
        <div className={split.length > 0 ? "mt-6 border-t border-line-subtle pt-5" : ""}>
          <h3 className="mb-3 text-[13px] font-semibold text-content-secondary">{f.t("decadesTitle")}</h3>
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
        </div>
      )}
    </StatsSection>
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
