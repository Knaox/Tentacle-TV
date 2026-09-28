import { memo, useMemo, useState } from "react";
import { DAYPARTS, RHYTHM_DAYS, RHYTHM_HOURS, type Daypart } from "@tentacle-tv/shared";
import { useStatsFormat } from "./useStatsFormat";

const PARTS = Object.keys(DAYPARTS) as Daypart[];

/** L'heure appartient-elle au moment de la journée (la nuit enjambe minuit) ? */
function inPart(hour: number, part: Daypart): boolean {
  const [from, to] = DAYPARTS[part];
  return (hour >= from && hour < to) || (hour + 24 >= from && hour + 24 < to);
}

/**
 * La grille jour × heure en tableau : sept jours, quatre moments de la
 * journée — l'équivalent lisible sans couleur ni souris, replié par défaut.
 */
export const RhythmTable = memo(function RhythmTable({ grid }: { grid: number[] }) {
  const f = useStatsFormat();
  const [open, setOpen] = useState(false);
  const rows = useMemo(
    () =>
      Array.from({ length: RHYTHM_DAYS }, (_, day) =>
        PARTS.map((part) =>
          Array.from({ length: RHYTHM_HOURS }, (_, hour) => hour).reduce(
            (sum, hour) => sum + (inPart(hour, part) ? grid[day * RHYTHM_HOURS + hour] : 0),
            0
          )
        )
      ),
    [grid]
  );

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
        <div className="mt-2 overflow-x-auto rounded-xl ring-1 ring-line-subtle">
          <table className="w-full text-left text-xs">
            <thead className="bg-fill-faint text-content-tertiary">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium" />
                {PARTS.map((part) => (
                  <th key={part} scope="col" className="px-3 py-2 text-right font-medium">{f.t(`daypart_${part}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody className="tabular-nums text-content-secondary">
              {rows.map((values, day) => (
                <tr key={day} className="border-t border-line-subtle">
                  <th scope="row" className="px-3 py-1.5 font-normal capitalize">{f.weekday(day)}</th>
                  {values.map((seconds, i) => (
                    <td key={PARTS[i]} className="px-3 py-1.5 text-right">{seconds > 0 ? f.duration(seconds) : "—"}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
});
