import { memo, useState } from "react";
import { ChevronDown, Info } from "lucide-react";
import type { ViewingStats } from "@tentacle-tv/shared";
import { useStatsFormat } from "./useStatsFormat";

/**
 * « À propos de ces chiffres » — d'où vient chaque nombre, dit simplement :
 * la mesure et sa date de départ, l'estimation d'avant, les comptes Jellyfin,
 * le fuseau appliqué, et la date du profil de goût. Replié par défaut.
 */
export const StatsAbout = memo(function StatsAbout({ stats }: { stats: ViewingStats }) {
  const f = useStatsFormat();
  const [open, setOpen] = useState(false);
  const since = stats.measuredSince ? f.isoDay(stats.measuredSince, true) : null;
  const lines = [
    since ? f.t("aboutMeasured", { date: since }) : null,
    since ? f.t("aboutEstimated") : f.t("aboutNoMeasure"),
    f.t("aboutCounts"),
    f.t("aboutTimeZone", { timeZone: stats.timeZone }),
    stats.taste.computedAt ? f.t("aboutTaste", { date: f.isoDay(stats.taste.computedAt, true) }) : null,
  ].filter((l): l is string => !!l);

  return (
    <section className="rounded-2xl bg-fill-faint ring-1 ring-line-subtle">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full cursor-pointer items-center gap-2 rounded-2xl px-4 py-3 text-left text-sm font-semibold text-content-secondary outline-none hover:text-content-primary focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
      >
        <Info size={16} aria-hidden />
        <span className="flex-1">{f.t("aboutTitle")}</span>
        <ChevronDown size={16} aria-hidden className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <ul className="space-y-1.5 px-4 pb-4 text-[13px] leading-relaxed text-content-tertiary">
          {lines.map((line) => <li key={line}>{line}</li>)}
        </ul>
      )}
    </section>
  );
});
