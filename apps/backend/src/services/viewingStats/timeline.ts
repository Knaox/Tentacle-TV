import type { ViewingStatsTimeline, ViewingStatsTimelineBucket, ViewingStatsTimelineUnit } from "./contract";
import { isEstimated, reliableDate } from "./dataset";
import type { StatsDataset } from "./dataset";
import type { PeriodWindow } from "./accumulate";
import { monthSpan, shiftDay, shiftMonth } from "./localCalendar";
import type { LocalCalendar, LocalParts } from "./localCalendar";

/** Au-delà de deux ans de mois, la frise passe à l'année : 25 colonnes ne se lisent plus. */
export const MONTHS_MAX = 24;

function keyOf(unit: ViewingStatsTimelineUnit, p: LocalParts): string {
  if (unit === "day") return p.day;
  if (unit === "month") return p.month;
  return String(p.year);
}

/** Les pas de la frise, du plus ancien au plus récent, tous présents (même vides). */
function bucketKeys(win: PeriodWindow, firstMonth: string | null): { unit: ViewingStatsTimelineUnit; keys: string[] } {
  const today = win.today;
  if (win.period === "30d") {
    return { unit: "day", keys: Array.from({ length: 30 }, (_, i) => shiftDay(today, i - 29)) };
  }
  const thisMonth = today.slice(0, 7);
  const from = win.period === "year" ? `${today.slice(0, 4)}-01` : firstMonth ?? thisMonth;
  const span = monthSpan(from, thisMonth);
  if (span <= MONTHS_MAX || win.period === "year") {
    return { unit: "month", keys: Array.from({ length: Math.max(1, span) }, (_, i) => shiftMonth(from, i)) };
  }
  const firstYear = Number(from.slice(0, 4));
  const lastYear = Number(today.slice(0, 4));
  return { unit: "year", keys: Array.from({ length: lastYear - firstYear + 1 }, (_, i) => String(firstYear + i)) };
}

/** Le premier mois d'activité datée : pour « tout », la frise commence là. */
function firstActiveMonth(data: StatsDataset, calendar: LocalCalendar): string | null {
  let first: string | null = null;
  for (const e of data.played) {
    const date = reliableDate(e);
    if (date === null || !isEstimated(e, data.epoch)) continue;
    const month = calendar.parts(date).month;
    if (first === null || month < first) first = month;
  }
  for (const seg of data.measured) {
    const month = calendar.parts(seg.startedAt).month;
    if (first === null || month < first) first = month;
  }
  return first;
}

/**
 * La frise d'une période : mesuré et estimé par pas. L'estimé se place à la
 * date de dernière lecture de chaque titre vu avant la mesure ; un titre sans
 * date fiable n'y figure pas (`undatedSeconds`), il n'a pas de place honnête.
 */
export function buildTimeline(
  data: StatsDataset,
  win: PeriodWindow,
  calendar: LocalCalendar,
  undatedSeconds: number
): ViewingStatsTimeline {
  const firstMonth = win.period === "all" ? firstActiveMonth(data, calendar) : null;
  const { unit, keys } = bucketKeys(win, firstMonth);
  const buckets = new Map<string, ViewingStatsTimelineBucket>(
    keys.map((key) => [key, { key, measuredSeconds: 0, estimatedSeconds: 0 }])
  );

  for (const seg of data.measured) {
    const p = calendar.parts(seg.startedAt);
    if (!win.contains(p.day)) continue;
    const b = buckets.get(keyOf(unit, p));
    if (b) b.measuredSeconds += seg.seconds;
  }
  for (const e of data.played) {
    if (!isEstimated(e, data.epoch)) continue;
    const date = reliableDate(e);
    if (date === null) continue;
    const p = calendar.parts(date);
    if (!win.contains(p.day)) continue;
    const b = buckets.get(keyOf(unit, p));
    if (b) b.estimatedSeconds += e.runtimeSeconds;
  }

  return {
    unit,
    buckets: keys.map((k) => {
      const b = buckets.get(k)!;
      return { key: k, measuredSeconds: Math.round(b.measuredSeconds), estimatedSeconds: Math.round(b.estimatedSeconds) };
    }),
    undatedSeconds: Math.round(undatedSeconds),
  };
}
