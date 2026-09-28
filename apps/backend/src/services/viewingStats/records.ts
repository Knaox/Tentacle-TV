import type { ViewingStatsRecords } from "./contract";
import { isEstimated, reliableDate } from "./dataset";
import type { StatsDataset } from "./dataset";
import type { PeriodWindow } from "./accumulate";
import { shiftDay } from "./localCalendar";
import type { LocalCalendar } from "./localCalendar";

/** Une journée ne compte comme « active » qu'à partir d'une minute mesurée. */
const ACTIVE_MIN_SECONDS = 60;
/** Deux séances séparées de moins de 20 minutes forment une seule séance. */
const SESSION_GAP_MS = 20 * 60_000;
/** Un épisode mesuré compte dans un marathon à partir de la moitié de sa durée (10 min sans durée). */
const BINGE_EPISODE_SHARE = 0.5;
const BINGE_EPISODE_FALLBACK_SECONDS = 600;

export interface RecordsResult {
  records: ViewingStatsRecords;
  activeDays: number;
}

function longestRun(days: string[]): { days: number; from: string; to: string } | null {
  if (days.length === 0) return null;
  const sorted = [...days].sort();
  let best = { days: 1, from: sorted[0], to: sorted[0] };
  let runFrom = sorted[0];
  let runLength = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === shiftDay(sorted[i - 1], 1)) runLength += 1;
    else {
      runFrom = sorted[i];
      runLength = 1;
    }
    if (runLength > best.days) best = { days: runLength, from: runFrom, to: sorted[i] };
  }
  return best;
}

/**
 * Les records d'une période : la journée la plus remplie (mesuré + estimé
 * daté), la plus longue suite de jours actifs, le marathon (le plus d'épisodes
 * d'une série en un jour) et la plus longue séance (séances mesurées bout à
 * bout, pauses de moins de 20 minutes comprises).
 */
export function buildRecords(
  data: StatsDataset,
  win: PeriodWindow,
  calendar: LocalCalendar,
  seriesName: (seriesId: string) => string
): RecordsResult {
  const perDay = new Map<string, number>();
  const measuredPerDay = new Map<string, number>();
  const active = new Set<string>();
  const episodesPerSeriesDay = new Map<string, Set<string>>();
  const addEpisode = (seriesId: string, day: string, itemId: string) => {
    const key = `${seriesId}|${day}`;
    const set = episodesPerSeriesDay.get(key) ?? new Set<string>();
    set.add(itemId);
    episodesPerSeriesDay.set(key, set);
  };

  for (const e of data.played) {
    const date = reliableDate(e);
    if (date === null) continue;
    const day = calendar.parts(date).day;
    if (!win.contains(day)) continue;
    active.add(day);
    if (isEstimated(e, data.epoch)) perDay.set(day, (perDay.get(day) ?? 0) + e.runtimeSeconds);
    if (e.kind === "episode") addEpisode(e.titleId, day, e.itemId);
  }

  const inPeriod = data.measured
    .filter((s) => win.contains(calendar.parts(s.startedAt).day))
    .sort((a, b) => a.startedAt - b.startedAt);
  for (const seg of inPeriod) {
    const day = calendar.parts(seg.startedAt).day;
    perDay.set(day, (perDay.get(day) ?? 0) + seg.seconds);
    measuredPerDay.set(day, (measuredPerDay.get(day) ?? 0) + seg.seconds);
    if (seg.kind === "episode") {
      const needed = seg.runtimeSeconds ? seg.runtimeSeconds * BINGE_EPISODE_SHARE : BINGE_EPISODE_FALLBACK_SECONDS;
      if (seg.seconds >= needed) addEpisode(seg.titleId, day, seg.itemId);
    }
  }
  for (const [day, seconds] of measuredPerDay) if (seconds >= ACTIVE_MIN_SECONDS) active.add(day);

  let biggestDay: ViewingStatsRecords["biggestDay"] = null;
  for (const [day, seconds] of perDay) {
    if (!biggestDay || seconds > biggestDay.seconds || (seconds === biggestDay.seconds && day > biggestDay.date)) {
      biggestDay = { date: day, seconds: Math.round(seconds) };
    }
  }

  let binge: ViewingStatsRecords["binge"] = null;
  for (const [key, items] of episodesPerSeriesDay) {
    const [seriesId, day] = key.split("|");
    if (items.size < 2) continue;
    if (!binge || items.size > binge.episodes || (items.size === binge.episodes && day > binge.date)) {
      binge = { seriesId, seriesName: seriesName(seriesId), episodes: items.size, date: day };
    }
  }

  // Séances mesurées bout à bout : la plus longue, et le titre qui l'a occupée.
  let longestSession: ViewingStatsRecords["longestSession"] = null;
  let runSeconds = 0;
  let runEnd = -Infinity;
  let runStart = 0;
  let runTitles = new Map<string, number>();
  const closeRun = () => {
    if (runSeconds <= 0) return;
    if (!longestSession || runSeconds > longestSession.seconds) {
      const top = [...runTitles.entries()].sort((a, b) => b[1] - a[1])[0];
      longestSession = { title: top ? top[0] : "", seconds: Math.round(runSeconds), date: calendar.parts(runStart).day };
    }
  };
  for (const seg of inPeriod) {
    if (seg.startedAt - runEnd > SESSION_GAP_MS) {
      closeRun();
      runSeconds = 0;
      runStart = seg.startedAt;
      runTitles = new Map();
    }
    runSeconds += seg.seconds;
    runEnd = Math.max(runEnd, seg.lastSeenAt);
    const name = data.titles.get(seg.titleId)?.name ?? "";
    runTitles.set(name, (runTitles.get(name) ?? 0) + seg.seconds);
  }
  closeRun();

  return {
    records: { biggestDay, longestStreak: longestRun([...active]), binge, longestSession },
    activeDays: active.size,
  };
}
