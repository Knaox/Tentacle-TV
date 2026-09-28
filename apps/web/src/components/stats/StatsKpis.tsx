import { memo, type ReactNode } from "react";
import { CalendarDays, Clapperboard, Layers, Tv } from "lucide-react";
import type { ViewingStatsTotals } from "@tentacle-tv/shared";
import { useStatsFormat } from "./useStatsFormat";

const Tile = memo(function Tile({ icon, value, label }: { icon: ReactNode; value: string; label: string }) {
  return (
    <li className="flex min-h-[72px] items-center gap-3 rounded-2xl bg-[color:var(--surface-1)] px-4 py-3 ring-1 ring-line-subtle">
      <span
        aria-hidden
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[var(--brand-light)]"
        style={{ background: "rgba(var(--brand-rgb), 0.14)" }}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-2xl font-bold leading-none text-content-primary">{value}</span>
        <span className="mt-1 block text-xs font-medium leading-tight text-content-tertiary">{label}</span>
      </span>
    </li>
  );
});

/**
 * Les comptes de la période, en quatre tuiles : films et épisodes vus
 * (exacts, lus de Jellyfin), séries regardées, jours de visionnage. Chiffres
 * proportionnels — une tuile n'est pas une colonne de tableau.
 */
export const StatsKpis = memo(function StatsKpis({ totals }: { totals: ViewingStatsTotals }) {
  const f = useStatsFormat();
  return (
    <ul className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
      <Tile icon={<Clapperboard size={18} />} value={f.number(totals.movies)} label={f.t("kpiMovies", { count: totals.movies })} />
      <Tile icon={<Tv size={18} />} value={f.number(totals.episodes)} label={f.t("kpiEpisodes", { count: totals.episodes })} />
      <Tile icon={<Layers size={18} />} value={f.number(totals.series)} label={f.t("kpiSeries", { count: totals.series })} />
      <Tile icon={<CalendarDays size={18} />} value={f.number(totals.activeDays)} label={f.t("kpiDays", { count: totals.activeDays })} />
    </ul>
  );
});
