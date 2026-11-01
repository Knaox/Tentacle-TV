import {
  ABANDON_MIN_IDLE_DAYS,
  DEVOURED_DAYS,
  DEVOURED_HOURS,
  EARLY_DROP_IDLE_DAYS,
  EARLY_DROP_MAX_EPISODES,
  EARLY_DROP_MAX_SHARE,
  EPISODE_FALLBACK_HOURS,
  FINISHED_SHARE,
  LONG_SERIES_MIN_EPISODES,
  PARTIAL_MIN_PROGRESS,
  SERIES_MIN_EPISODES,
  START_MIN_MINUTES,
  START_MIN_PROGRESS,
  WATCHED_MIN_PROGRESS,
  playAgeDays,
} from "./anchorSignals";
import type { PlayedEpisode } from "./anchorTypes";
import type { SignalItem } from "./signals";

/**
 * Ce que disent les VISIONNAGES d'un compte, au-delà du « vu » de Jellyfin —
 * qui ne marque vu qu'à 92 % (`MaxResumePct`) et tient pour « en cours » un
 * épisode ouvert à 0 % (`MinResumePct`). Pur : l'appelant fournit les signaux.
 */

const TICKS_PER_HOUR = 36_000_000_000;
const TICKS_PER_MINUTE = 600_000_000;
const DAY_MS = 86_400_000;

export type ResumeVerdict =
  /** ≥ 80 % : arrêté au générique — un visionnage. */
  | { kind: "watched"; progress: number }
  /** 25-80 % : une part du visionnage. */
  | { kind: "partial"; progress: number }
  /** Un vrai départ (≥ 5 min ou 5 %), sous 25 % : le germe d'un abandon. */
  | { kind: "started"; progress: number }
  /** Ouvert, sans plus (0-1 %), ou sans durée connue : rien. */
  | { kind: "none" };

/** Pur : ce que vaut un élément entamé, d'après sa position. */
export function classifyResume(item: SignalItem): ResumeVerdict {
  const runtime = item.RunTimeTicks ?? 0;
  const position = item.UserData?.PlaybackPositionTicks ?? 0;
  if (runtime <= 0 || position <= 0) return { kind: "none" };
  const progress = Math.min(1, position / runtime);
  if (progress >= WATCHED_MIN_PROGRESS) return { kind: "watched", progress };
  if (progress >= PARTIAL_MIN_PROGRESS) return { kind: "partial", progress };
  if (position >= START_MIN_MINUTES * TICKS_PER_MINUTE || progress >= START_MIN_PROGRESS) {
    return { kind: "started", progress };
  }
  return { kind: "none" };
}

export interface SeriesViewing {
  hours: number;
  /** Épisodes vus — ceux arrêtés à ≥ 80 % compris. */
  episodes: number;
  /** Dernier épisode vraiment regardé (un marquage en masse ne date rien). */
  last: string | null;
  /** Dernière lecture QUELCONQUE de la série (partiels compris, en masse compris) :
   *  ce qui dit si quelque chose a été vu après un abandon. */
  lastAny: string | null;
  /** Le plus d'heures regardées dans une fenêtre de DEVOURED_DAYS jours. */
  peakHours: number;
}

function later(a: string | null, b: string | null | undefined): string | null {
  if (!b || !Number.isFinite(Date.parse(b))) return a;
  if (!a) return b;
  return Date.parse(b) > Date.parse(a) ? b : a;
}

function hoursOf(ticks: number | undefined): number {
  return ticks && ticks > 0 ? ticks / TICKS_PER_HOUR : EPISODE_FALLBACK_HOURS;
}

/**
 * Pur : le visionnage de chaque série — épisodes vus, plus les épisodes
 * entamés (≥ 80 % : vus ; 25-80 % : leurs heures au prorata, sans compter
 * l'épisode).
 */
export function seriesViewings(
  playedEpisodes: readonly PlayedEpisode[],
  resumable: readonly SignalItem[],
  bulk: ReadonlySet<string>,
  now: number
): Map<string, SeriesViewing> {
  const out = new Map<string, SeriesViewing>();
  const dated = new Map<string, Array<{ at: number; hours: number }>>();
  const add = (seriesId: string, hours: number, counted: boolean, date: string | null | undefined) => {
    const s = out.get(seriesId) ?? { hours: 0, episodes: 0, last: null, lastAny: null, peakHours: 0 };
    s.hours += hours;
    if (counted) s.episodes++;
    s.lastAny = later(s.lastAny, date);
    if (date && playAgeDays(date, bulk, now) < 365) {
      s.last = later(s.last, date);
      const list = dated.get(seriesId) ?? [];
      list.push({ at: Date.parse(date), hours });
      dated.set(seriesId, list);
    }
    out.set(seriesId, s);
  };
  for (const ep of playedEpisodes) {
    if (ep.SeriesId) add(ep.SeriesId, hoursOf(ep.RunTimeTicks), true, ep.UserData?.LastPlayedDate);
  }
  for (const item of resumable) {
    if (item.Type !== "Episode" || !item.SeriesId) continue;
    const verdict = classifyResume(item);
    if (verdict.kind === "watched") add(item.SeriesId, hoursOf(item.RunTimeTicks), true, item.UserData?.LastPlayedDate);
    else if (verdict.kind === "partial") add(item.SeriesId, hoursOf(item.RunTimeTicks) * verdict.progress, false, item.UserData?.LastPlayedDate);
    else if (verdict.kind === "started") {
      // Un départ sans plus ne pèse rien, mais il DATE la série (« vu depuis ? »).
      const s = out.get(item.SeriesId);
      if (s) s.lastAny = later(s.lastAny, item.UserData?.LastPlayedDate);
    }
  }
  for (const [seriesId, list] of dated) {
    list.sort((x, y) => x.at - y.at);
    let peak = 0;
    let sum = 0;
    let start = 0;
    for (const entry of list) {
      sum += entry.hours;
      while (entry.at - list[start].at > DEVOURED_DAYS * DAY_MS) sum -= list[start++].hours;
      peak = Math.max(peak, sum);
    }
    out.get(seriesId)!.peakHours = peak;
  }
  return out;
}

/** Épisodes que la bibliothèque a d'une série (RecursiveItemCount), ou null. */
export function availableEpisodes(series: SignalItem | undefined): number | null {
  const n = series?.RecursiveItemCount;
  return typeof n === "number" && n > 0 ? n : null;
}

/** Pur : une série LONGUE lâchée tôt — quelques épisodes, puis plus rien depuis un mois. */
export function isEarlyDrop(view: SeriesViewing, available: number | null, now: number): boolean {
  if (available == null || available < LONG_SERIES_MIN_EPISODES) return false;
  if (view.episodes > EARLY_DROP_MAX_EPISODES || view.episodes >= available * EARLY_DROP_MAX_SHARE) return false;
  const last = view.lastAny ? Date.parse(view.lastAny) : NaN;
  return !Number.isFinite(last) || (now - last) / DAY_MS >= EARLY_DROP_IDLE_DAYS;
}

/** Pur : finie ou presque. */
export function isFinished(view: SeriesViewing, available: number | null): boolean {
  return available != null && view.episodes >= SERIES_MIN_EPISODES && view.episodes >= available * FINISHED_SHARE;
}

export function isDevoured(view: SeriesViewing): boolean {
  return view.peakHours >= DEVOURED_HOURS;
}

export interface Abandon {
  /** Le TITRE abandonné : le film, ou la fiche de la série. */
  target: SignalItem;
  idleDays: number;
}

/**
 * Pur : les abandons, UN par titre. Un film entamé d'un vrai départ, sous
 * 25 %, laissé un mois ; une série dont un épisode l'a été, si elle n'est pas
 * suivie (moins de trois épisodes vus) et si RIEN n'en a été vu depuis.
 * Quatre épisodes ouverts ne font plus quatre abandons.
 */
export function abandonsOf(input: {
  resumable: readonly SignalItem[];
  playedMovieIds: ReadonlySet<string>;
  series: ReadonlyMap<string, SeriesViewing>;
  seriesById: ReadonlyMap<string, SignalItem>;
  now: number;
}): Abandon[] {
  const latest = new Map<string, { target: SignalItem; at: number }>();
  for (const item of input.resumable) {
    if (input.playedMovieIds.has(item.Id) || classifyResume(item).kind !== "started") continue;
    const at = Date.parse(item.UserData?.LastPlayedDate ?? "");
    if (!Number.isFinite(at) || (input.now - at) / DAY_MS < ABANDON_MIN_IDLE_DAYS) continue;
    let target: SignalItem | undefined = item;
    let key = item.Id;
    if (item.Type === "Episode") {
      if (!item.SeriesId) continue;
      const view = input.series.get(item.SeriesId);
      if ((view?.episodes ?? 0) >= SERIES_MIN_EPISODES) continue;
      // Vu quelque chose de la série APRÈS ce départ : ce n'est pas un abandon.
      const lastAny = view?.lastAny ? Date.parse(view.lastAny) : NaN;
      if (Number.isFinite(lastAny) && lastAny > at) continue;
      target = input.seriesById.get(item.SeriesId);
      key = item.SeriesId;
    } else if (item.Type !== "Movie") continue;
    if (!target) continue;
    const cur = latest.get(key);
    if (!cur || at > cur.at) latest.set(key, { target, at });
  }
  return [...latest.values()].map(({ target, at }) => ({ target, idleDays: (input.now - at) / DAY_MS }));
}
