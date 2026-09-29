import { memo } from "react";
import { Info } from "lucide-react";
import { heroFigure, VIEWING_STATS_PERIODS, type ViewingStats, type ViewingStatsPeriod } from "@tentacle-tv/shared";
import { SegmentedControl } from "../library/SegmentedControl";
import { useStatsFormat } from "./useStatsFormat";

/** En dessous : « encore quelques séances », le profil n'est pas encore net. */
const LITTLE_HISTORY_SECONDS = 2 * 3600;

interface StatsOverviewProps {
  stats: ViewingStats;
  period: ViewingStatsPeriod;
  /** Absent : la période est fixée (la page publique d'un partage), dite par l'en-tête — rien à choisir ici. */
  onPeriodChange?: (period: ViewingStatsPeriod) => void;
  /** Vrai pendant qu'une autre période se charge : l'ancienne reste, estompée. */
  pending: boolean;
  /** Faux sur une période vide : le chiffre et la période restent, pas les compteurs. */
  counters: boolean;
}

/**
 * La vue d'ensemble, en une carte : le temps passé devant l'écran — UN
 * chiffre, à l'encre du texte, dans la police de tout le reste —, ce qu'il
 * représente et d'où il vient ; la période, qui règle toute la page ; puis
 * les quatre comptes (films, épisodes, séries, jours), séparés par des filets
 * plutôt qu'empilés en tuiles.
 */
export const StatsOverview = memo(function StatsOverview({ stats, period, onPeriodChange, pending, counters }: StatsOverviewProps) {
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
  const items = [
    { key: "movies", value: totals.movies, label: f.t("kpiMovies", { count: totals.movies }) },
    { key: "episodes", value: totals.episodes, label: f.t("kpiEpisodes", { count: totals.episodes }) },
    { key: "series", value: totals.series, label: f.t("kpiSeries", { count: totals.series }) },
    { key: "days", value: totals.activeDays, label: f.t("kpiDays", { count: totals.activeDays }) },
  ];

  return (
    <section className="overflow-hidden rounded-2xl bg-[color:var(--surface-1)] ring-1 ring-line-subtle" aria-label={f.t("title")}>
      <div className="flex flex-col-reverse gap-5 p-5 md:flex-row md:items-start md:justify-between md:p-6">
        <div className={`min-w-0 transition-opacity duration-200 ${pending ? "opacity-60" : "opacity-100"}`} aria-live="polite">
          <p className="text-sm text-content-secondary">{f.t(`heroLead_${period}`)}</p>
          <p className="mt-1.5 flex flex-wrap items-baseline gap-x-2.5">
            <span className="text-[52px] font-extrabold leading-none tracking-[-0.03em] text-content-primary md:text-[64px]">
              {figure.value}
            </span>
            <span className="text-xl font-semibold text-content-secondary md:text-2xl">
              {f.t(figure.unit === "hours" ? "unitHours" : "unitMinutes", { count: figure.count })}
            </span>
          </p>
          {equivalence && <p className="mt-2 text-[15px] text-content-secondary">{equivalence}</p>}
          <p className="mt-3 flex items-start gap-1.5 text-xs leading-snug text-content-tertiary">
            <Info size={13} aria-hidden className="mt-px shrink-0" />
            {source}
          </p>
          {totals.seconds > 0 && totals.seconds < LITTLE_HISTORY_SECONDS && (
            <p className="mt-2 text-sm text-content-secondary">{f.t("littleHistory")}</p>
          )}
        </div>
        {onPeriodChange && (
          <SegmentedControl
            label={f.t("periodGroup")}
            markerId="stats-period"
            value={period}
            onChange={onPeriodChange}
            options={VIEWING_STATS_PERIODS.map((p) => ({ value: p, label: f.t(`period_${p}`) }))}
          />
        )}
      </div>
      {counters && (
        <ul
          className={`grid grid-cols-2 gap-px border-t border-line-subtle bg-line-subtle transition-opacity duration-200 sm:grid-cols-4 ${pending ? "opacity-60" : "opacity-100"}`}
        >
          {items.map((item) => (
            <li key={item.key} className="bg-[color:var(--surface-1)] px-5 py-4 md:px-6">
              <span className="block text-2xl font-bold leading-none text-content-primary">{f.number(item.value)}</span>
              <span className="mt-1.5 block text-xs font-medium text-content-tertiary">{item.label}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
});
