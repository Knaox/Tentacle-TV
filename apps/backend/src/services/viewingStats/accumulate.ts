import type { ViewingStatsPeriod } from "./contract";
import { isEstimated, reliableDate } from "./dataset";
import type { StatsDataset } from "./dataset";
import { shiftDay } from "./localCalendar";
import type { LocalCalendar } from "./localCalendar";

/**
 * Une période, en jours LOCAUX : les 30 derniers jours (aujourd'hui compris),
 * l'année civile en cours, ou tout. On compare des chaînes « AAAA-MM-JJ » —
 * aucun calcul d'instant de minuit, donc aucun piège de changement d'heure.
 */
export interface PeriodWindow {
  period: ViewingStatsPeriod;
  today: string;
  /** Premier jour inclus ; null pour « tout ». */
  fromDay: string | null;
  contains(day: string): boolean;
}

export function periodWindow(period: ViewingStatsPeriod, calendar: LocalCalendar, now: number): PeriodWindow {
  const today = calendar.parts(now).day;
  if (period === "all") return { period, today, fromDay: null, contains: () => true };
  const fromDay = period === "30d" ? shiftDay(today, -29) : `${today.slice(0, 4)}-01-01`;
  return { period, today, fromDay, contains: (day) => day >= fromDay && day <= today };
}

/** Ce qu'une période retient d'un titre. */
export interface TitleTotal {
  titleId: string;
  measuredSeconds: number;
  estimatedSeconds: number;
  /** Films : 1 s'il est marqué « vu » dans la période. Séries : épisodes vus. */
  played: number;
  /** Dernière activité connue (ms) : lecture fiable ou fin de séance mesurée. */
  lastActiveAt: number | null;
  /** Films : jours où la mesure l'a vu à 60 % ou plus. */
  viewings: number;
}

export interface PeriodAccumulation {
  byTitle: Map<string, TitleTotal>;
  measuredSeconds: number;
  estimatedSeconds: number;
  /** Estimé sans date fiable : dans le total de « tout », hors de la frise. */
  undatedSeconds: number;
  movies: number;
  episodes: number;
}

/** Part de la durée à partir de laquelle une séance mesurée vaut « un visionnage ». */
export const VIEWING_MIN_SHARE = 0.6;

function totalOf(map: Map<string, TitleTotal>, titleId: string): TitleTotal {
  let t = map.get(titleId);
  if (!t) {
    t = { titleId, measuredSeconds: 0, estimatedSeconds: 0, played: 0, lastActiveAt: null, viewings: 0 };
    map.set(titleId, t);
  }
  return t;
}

function touch(t: TitleTotal, at: number | null): void {
  if (at !== null && (t.lastActiveAt === null || at > t.lastActiveAt)) t.lastActiveAt = at;
}

/**
 * Plie le jeu de données sur une période : temps mesuré et estimé par titre,
 * comptes exacts de films et d'épisodes, et « revus » vérifiés des films.
 */
export function accumulate(data: StatsDataset, win: PeriodWindow, calendar: LocalCalendar): PeriodAccumulation {
  const byTitle = new Map<string, TitleTotal>();
  let measuredSeconds = 0;
  let estimatedSeconds = 0;
  let undatedSeconds = 0;
  let movies = 0;
  let episodes = 0;

  for (const entry of data.played) {
    const date = reliableDate(entry);
    const inPeriod = win.fromDay === null || (date !== null && win.contains(calendar.parts(date).day));
    if (!inPeriod) continue;
    const t = totalOf(byTitle, entry.titleId);
    t.played += 1;
    touch(t, date);
    if (entry.kind === "movie") movies += 1;
    else episodes += 1;
    if (!isEstimated(entry, data.epoch)) continue;
    t.estimatedSeconds += entry.runtimeSeconds;
    estimatedSeconds += entry.runtimeSeconds;
    if (date === null) undatedSeconds += entry.runtimeSeconds;
  }

  // Films : secondes mesurées par (film, jour) — un jour à 60 % de la durée
  // ou plus est un visionnage. Deux jours distincts : « revu », sans deviner.
  const movieDays = new Map<string, number>();
  for (const seg of data.measured) {
    const day = calendar.parts(seg.startedAt).day;
    if (!win.contains(day)) continue;
    const t = totalOf(byTitle, seg.titleId);
    t.measuredSeconds += seg.seconds;
    measuredSeconds += seg.seconds;
    touch(t, seg.lastSeenAt);
    if (seg.kind === "movie" && seg.runtimeSeconds) {
      const key = `${seg.itemId}|${day}`;
      movieDays.set(key, (movieDays.get(key) ?? 0) + seg.seconds);
    }
  }
  const runtimeOf = new Map<string, number>();
  for (const seg of data.measured) if (seg.kind === "movie" && seg.runtimeSeconds) runtimeOf.set(seg.itemId, seg.runtimeSeconds);
  for (const [key, seconds] of movieDays) {
    const itemId = key.slice(0, key.indexOf("|"));
    const runtime = runtimeOf.get(itemId) ?? 0;
    if (runtime > 0 && seconds >= runtime * VIEWING_MIN_SHARE) {
      const t = byTitle.get(itemId);
      if (t) t.viewings += 1;
    }
  }

  return { byTitle, measuredSeconds, estimatedSeconds, undatedSeconds, movies, episodes };
}
