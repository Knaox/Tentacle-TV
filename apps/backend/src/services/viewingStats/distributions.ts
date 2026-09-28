import type { ViewingStatsDecade, ViewingStatsDevice, ViewingStatsDeviceShare, ViewingStatsSplit } from "./contract";
import type { MeasuredEntry, TitleInfo } from "./dataset";
import type { PeriodWindow, TitleTotal } from "./accumulate";
import type { LocalCalendar } from "./localCalendar";

/** Une part SANS libellé : le libellé dépend de la langue, posé à la réponse. */
export interface KeyedShare {
  key: string;
  seconds: number;
  share: number;
}

export const GENRES_MAX = 8;
export const DEVICES_MAX = 6;
/**
 * Plancher de bruit : moins d'une minute ne fait ni un genre, ni un pays, ni
 * une langue, ni un visage, ni un appareil. Une lecture d'essai de deux
 * secondes s'afficherait sinon en « 0 % » dans chaque classement.
 */
export const NOISE_SECONDS = 60;

export const secondsOf = (t: TitleTotal) => t.measuredSeconds + t.estimatedSeconds;

/** Les `max` premières parts d'une carte clé → secondes, rapportées à `total`. */
export function rankedShares(map: Map<string, number>, total: number, max: number): KeyedShare[] {
  return [...map.entries()]
    .filter(([, s]) => s >= NOISE_SECONDS)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, max)
    .map(([key, s]) => ({ key, seconds: Math.round(s), share: total > 0 ? Math.min(1, s / total) : 0 }));
}

/** Genres (ids TMDB), pondérés par le temps passé : un titre compte dans chacun des siens. */
export function genreShares(totals: Iterable<TitleTotal>, titles: Map<string, TitleInfo>, totalSeconds: number): KeyedShare[] {
  const genres = new Map<string, number>();
  for (const t of totals) {
    const info = titles.get(t.titleId);
    const s = secondsOf(t);
    if (!info || s <= 0) continue;
    for (const g of new Set(info.genreIds)) genres.set(String(g), (genres.get(String(g)) ?? 0) + s);
  }
  return rankedShares(genres, totalSeconds, GENRES_MAX);
}

/** Films / séries / animés : trois natures qui ne se recouvrent pas. */
export function splitOf(totals: Iterable<TitleTotal>, titles: Map<string, TitleInfo>): ViewingStatsSplit {
  const split = { movieSeconds: 0, seriesSeconds: 0, animeSeconds: 0 };
  for (const t of totals) {
    const info = titles.get(t.titleId);
    const s = secondsOf(t);
    if (!info || s <= 0) continue;
    if (info.anime) split.animeSeconds += s;
    else if (info.kind === "movie") split.movieSeconds += s;
    else split.seriesSeconds += s;
  }
  return {
    movieSeconds: Math.round(split.movieSeconds),
    seriesSeconds: Math.round(split.seriesSeconds),
    animeSeconds: Math.round(split.animeSeconds),
  };
}

export function decadesOf(totals: Iterable<TitleTotal>, titles: Map<string, TitleInfo>): ViewingStatsDecade[] {
  const decades = new Map<number, number>();
  for (const t of totals) {
    const year = titles.get(t.titleId)?.year;
    const s = secondsOf(t);
    if (!year || year < 1880 || s <= 0) continue;
    const decade = Math.floor(year / 10) * 10;
    decades.set(decade, (decades.get(decade) ?? 0) + s);
  }
  return [...decades.entries()]
    .filter(([, s]) => s >= NOISE_SECONDS)
    .sort((a, b) => a[0] - b[0])
    .map(([decade, s]) => ({ decade, seconds: Math.round(s) }));
}

/** L'application d'après le nom de client Jellyfin — celui que posent nos clients. */
export function deviceOf(client: string | null): { device: ViewingStatsDevice; client: string | null } {
  const name = (client ?? "").trim();
  const ours = /^tentacle(?:\s*tv)?\s*-\s*(web|desktop|mobile|tv|webos)$/i.exec(name);
  if (ours) return { device: ours[1].toLowerCase() as ViewingStatsDevice, client: null };
  return { device: "other", client: name ? name.slice(0, 40) : null };
}

export function devicesOf(measured: MeasuredEntry[], win: PeriodWindow, calendar: LocalCalendar): ViewingStatsDeviceShare[] {
  const perDevice = new Map<string, ViewingStatsDeviceShare>();
  for (const seg of measured) {
    if (seg.seconds <= 0 || !win.contains(calendar.parts(seg.startedAt).day)) continue;
    const { device, client } = deviceOf(seg.client);
    const key = `${device}|${client ?? ""}`;
    const cur = perDevice.get(key) ?? { device, client, seconds: 0 };
    cur.seconds += seg.seconds;
    perDevice.set(key, cur);
  }
  return [...perDevice.values()]
    .filter((d) => d.seconds >= NOISE_SECONDS)
    .sort((a, b) => b.seconds - a.seconds)
    .slice(0, DEVICES_MAX)
    .map((d) => ({ ...d, seconds: Math.round(d.seconds) }));
}
