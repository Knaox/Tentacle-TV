import type { MeasuredEntry } from "./dataset";
import type { PeriodWindow } from "./accumulate";
import { SLOT_MS } from "./localCalendar";
import type { LocalCalendar } from "./localCalendar";

export const RHYTHM_CELLS = 7 * 24;

/**
 * Au-delà de ce rapport entre l'étendue d'une séance et son temps crédité, la
 * séance a surtout été en pause : étaler ses secondes sur toute l'étendue
 * repeindrait des heures où l'on ne regardait pas. On les pose alors d'un seul
 * tenant depuis le début — le moment où la lecture a commencé est le seul
 * qu'on connaisse à coup sûr.
 */
const PAUSE_HEAVY_RATIO = 2;

/**
 * La grille jour × heure : les secondes MESURÉES de la période, réparties sur
 * les heures locales que chaque séance a traversées, au prorata. Une séance de
 * 20 h 40 à 22 h 10 nourrit trois cases, pas une.
 */
export function buildRhythm(measured: MeasuredEntry[], win: PeriodWindow, calendar: LocalCalendar): number[] {
  const grid = new Array<number>(RHYTHM_CELLS).fill(0);
  for (const seg of measured) {
    if (seg.seconds <= 0) continue;
    if (!win.contains(calendar.parts(seg.startedAt).day)) continue;

    const creditedMs = seg.seconds * 1000;
    const spanMs = seg.lastSeenAt - seg.startedAt;
    const start = seg.startedAt;
    const end = spanMs > 0 && spanMs <= creditedMs * PAUSE_HEAVY_RATIO ? seg.lastSeenAt : start + creditedMs;
    const length = end - start;

    for (let slotStart = Math.floor(start / SLOT_MS) * SLOT_MS; slotStart < end; slotStart += SLOT_MS) {
      const overlap = Math.min(end, slotStart + SLOT_MS) - Math.max(start, slotStart);
      if (overlap <= 0) continue;
      const p = calendar.parts(slotStart);
      grid[p.weekday * 24 + p.hour] += (seg.seconds * overlap) / length;
    }
  }
  return grid.map((s) => Math.round(s));
}
