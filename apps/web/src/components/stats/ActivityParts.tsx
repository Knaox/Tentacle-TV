import { memo, useState } from "react";
import type { ViewingStatsTimeline } from "@tentacle-tv/shared";
import { useStatsFormat } from "./useStatsFormat";

/**
 * La légende d'un graphique à plusieurs séries : une pastille de la forme de
 * la marque (un rectangle pour des barres) et un libellé à l'encre du texte —
 * jamais le texte à la couleur de la série.
 */
export const ChartLegend = memo(function ChartLegend({ items }: { items: Array<{ color: string; label: string }> }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-content-secondary">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-2">
          <span aria-hidden className="h-2.5 w-2.5 rounded-[3px]" style={{ background: item.color }} />
          {item.label}
        </li>
      ))}
    </ul>
  );
});

/**
 * La frise en tableau — son équivalent lisible sans souris ni couleurs,
 * replié par défaut. Seuls les pas non vides y figurent.
 */
export const ActivityTable = memo(function ActivityTable({ timeline }: { timeline: ViewingStatsTimeline }) {
  const f = useStatsFormat();
  const [open, setOpen] = useState(false);
  const rows = timeline.buckets.filter((b) => b.measuredSeconds + b.estimatedSeconds > 0);
  if (rows.length === 0) return null;
  return (
    <div className="mt-3">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="cursor-pointer rounded-full text-xs font-medium text-content-tertiary underline-offset-4 outline-none hover:text-content-primary hover:underline focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
      >
        {open ? f.t("hideTable") : f.t("showTable")}
      </button>
      {open && (
        <div className="mt-2 max-h-72 overflow-auto rounded-xl ring-1 ring-line-subtle">
          <table className="w-full text-left text-xs">
            <thead className="bg-fill-faint text-content-tertiary">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">{f.t("tableWhen")}</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">{f.t("tableMeasured")}</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">{f.t("tableEstimated")}</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">{f.t("tableTotal")}</th>
              </tr>
            </thead>
            <tbody className="tabular-nums text-content-secondary">
              {rows.map((b) => (
                <tr key={b.key} className="border-t border-line-subtle">
                  <th scope="row" className="px-3 py-1.5 font-normal">{f.bucket(timeline.unit, b.key)}</th>
                  <td className="px-3 py-1.5 text-right">{b.measuredSeconds > 0 ? f.duration(b.measuredSeconds) : "—"}</td>
                  <td className="px-3 py-1.5 text-right">{b.estimatedSeconds > 0 ? f.duration(b.estimatedSeconds) : "—"}</td>
                  <td className="px-3 py-1.5 text-right font-semibold text-content-primary">
                    {f.duration(b.measuredSeconds + b.estimatedSeconds)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
});
