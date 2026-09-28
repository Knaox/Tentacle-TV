import { memo } from "react";
import { Info } from "lucide-react";
import { heroFigure, VIEWING_STATS_PERIODS, type ViewingStats, type ViewingStatsPeriod } from "@tentacle-tv/shared";
import { SegmentedControl } from "../library/SegmentedControl";
import { useStatsFormat } from "./useStatsFormat";

/** En dessous : « encore quelques séances », le profil n'est pas encore net. */
const LITTLE_HISTORY_SECONDS = 2 * 3600;

interface StatsHeroFigureProps {
  stats: ViewingStats;
  period: ViewingStatsPeriod;
  onPeriodChange: (period: ViewingStatsPeriod) => void;
  /** Vrai pendant qu'une autre période se charge : l'ancienne reste, estompée. */
  pending: boolean;
}

/**
 * Le chiffre qui ouvre la page — UN seul, en très grand, dans la police de
 * tout le reste : le temps passé devant l'écran sur la période, sa
 * traduction en journées (ou en longs métrages), et d'où il vient (mesuré,
 * estimé, ou les deux). Le choix de la période est juste à côté : il règle
 * TOUT ce qui suit.
 */
export const StatsHeroFigure = memo(function StatsHeroFigure({ stats, period, onPeriodChange, pending }: StatsHeroFigureProps) {
  const f = useStatsFormat();
  const { totals, measuredSince } = stats;
  const figure = heroFigure(totals.seconds, f.locale);
  const days = Math.floor(totals.seconds / 86_400);
  const movies = Math.floor(totals.seconds / 7_200);
  const equivalence = days >= 1
    ? f.t("heroDays", { count: days })
    : movies >= 2 ? f.t("heroMovies", { count: movies }) : null;
  const since = measuredSince ? f.isoDay(measuredSince, true) : "";
  const source = totals.measuredSeconds > 0 && totals.estimatedSeconds > 0
    ? f.t("sourceMixed", { date: since })
    : totals.measuredSeconds > 0 ? f.t("sourceMeasured", { date: since }) : f.t("sourceEstimated");

  return (
    <div className="rounded-[var(--radius-xl)] bg-[color:var(--surface-1)] p-4 ring-1 ring-line-subtle md:p-6">
      <div className="flex flex-col-reverse gap-4 md:flex-row md:items-start md:justify-between">
        <div className={`min-w-0 transition-opacity duration-200 ${pending ? "opacity-60" : "opacity-100"}`} aria-live="polite">
          <p className="text-sm font-medium text-content-secondary">{f.t(`heroLead_${period}`)}</p>
          <p className="mt-1 flex items-baseline gap-3">
            <span
              className="text-[56px] font-extrabold leading-none tracking-tight md:text-[72px]"
              style={{
                background: "linear-gradient(135deg, var(--brand-light), var(--brand-accent))",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              {figure.value}
            </span>
            <span className="text-2xl font-bold text-content-primary md:text-3xl">
              {f.t(figure.unit === "hours" ? "unitHours" : "unitMinutes", { count: figure.count })}
            </span>
          </p>
          {equivalence && <p className="mt-2 text-[15px] text-content-secondary">{equivalence}</p>}
          <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-content-tertiary">
            <Info size={13} aria-hidden />
            {source}
          </p>
          {totals.seconds > 0 && totals.seconds < LITTLE_HISTORY_SECONDS && (
            <p className="mt-2 text-sm text-content-secondary">{f.t("littleHistory")}</p>
          )}
        </div>
        <SegmentedControl
          label={f.t("periodGroup")}
          markerId="stats-period"
          value={period}
          onChange={onPeriodChange}
          options={VIEWING_STATS_PERIODS.map((p) => ({ value: p, label: f.t(`period_${p}`) }))}
        />
      </div>
    </div>
  );
});
