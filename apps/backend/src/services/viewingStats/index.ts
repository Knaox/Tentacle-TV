import { VIEWING_STATS_PERIODS } from "./contract";
import type { ViewingStats, ViewingStatsPeriod, ViewingStatsTaste } from "./contract";
import type { StatsDataset, TitleInfo } from "./dataset";
import { accumulate, periodWindow } from "./accumulate";
import { computePeriod } from "./computePeriod";
import type { PeriodCore } from "./computePeriod";
import { secondsOf } from "./distributions";
import { foldJudgments, loadJudgments } from "./judgments";
import type { LoadedJudgments } from "./judgments";
import { listeningSince } from "./listening";
import { LocalCalendar } from "./localCalendar";
import { fetchMeasured, measuredEpoch } from "./measuredHistory";
import type { MeasuredHistory } from "./measuredHistory";
import { fetchPlayedHistory } from "./playedHistory";
import { presentStats } from "./present";
import type { ComputedStats, StatsLang } from "./present";
import { readTaste } from "./taste";
import type { LibraryTitle } from "./taste";
import { decorateTitles, describeTitles } from "./titleCatalog";
import { attachPortraits, enrichWithTmdb } from "./titleMeta";

/**
 * Statistiques de visionnage d'un compte — l'assemblage.
 *
 * Un calcul lit tout ce qu'il faut UNE fois (Jellyfin, séances mesurées,
 * fiches TMDB en cache, profil de goût), produit les trois périodes d'un
 * coup, puis abandonne ses données brutes : seul le résumé (quelques Ko par
 * compte et par fuseau) reste en mémoire, dix minutes au plus, trente comptes
 * au plus. Changer de période ne relance donc rien.
 */

const TTL_MS = 10 * 60_000;
/** « Tirer pour rafraîchir » ne recalcule pas plus d'une fois toutes les 30 s. */
const REFRESH_MIN_MS = 30_000;
const CACHE_MAX = 30;

interface Entry {
  value: ComputedStats;
  at: number;
}

const cache = new Map<string, Entry>();
const inFlight = new Map<string, Promise<Entry>>();

function remember(key: string, entry: Entry): void {
  cache.delete(key);
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, entry);
}

/** Une base indisponible ne prive pas la page de Jellyfin : pas de mesure, tout est estimé. */
async function measuredOrEmpty(userId: string): Promise<{ history: MeasuredHistory; epoch: number | null }> {
  try {
    const [history, epoch] = await Promise.all([fetchMeasured(userId), measuredEpoch()]);
    return { history, epoch };
  } catch {
    return { history: { entries: [], movieNames: new Map(), seriesNames: new Map() }, epoch: null };
  }
}

/** Une base indisponible ne prive pas la page de ses chiffres : aucun avis, les favoris Jellyfin restent. */
async function judgmentsOrEmpty(userId: string, favorites: Set<string>): Promise<LoadedJudgments> {
  try {
    return await loadJudgments(userId, favorites);
  } catch {
    return foldJudgments([], [], [], 0, favorites);
  }
}

function libraryResolver(titles: Map<string, TitleInfo>, favorites: Map<string, string>): (key: string) => LibraryTitle | null {
  const byTmdb = new Map<string, LibraryTitle>();
  for (const [key, id] of favorites) byTmdb.set(key, { id, name: titles.get(id)?.name ?? "" });
  for (const t of titles.values()) {
    if (t.tmdbId) byTmdb.set(`${t.kind === "movie" ? "movie" : "tv"}:${t.tmdbId}`, { id: t.id, name: t.name });
  }
  return (key) => {
    if (key.startsWith("jf:")) {
      const t = titles.get(key.slice(3));
      return t ? { id: t.id, name: t.name } : null;
    }
    return byTmdb.get(key) ?? null;
  };
}

async function compute(userId: string, timeZone: string): Promise<ComputedStats> {
  const now = Date.now();
  const [history, measured] = await Promise.all([fetchPlayedHistory(userId), measuredOrEmpty(userId)]);

  const seriesNames = new Map([...measured.history.seriesNames, ...history.seriesNames]);
  const extraMovies = new Map([...measured.history.movieNames].filter(([id]) => !history.movies.has(id)));
  const [described, judged] = await Promise.all([
    describeTitles(userId, seriesNames, extraMovies),
    judgmentsOrEmpty(userId, history.favorites.ids),
  ]);
  const titles = new Map<string, TitleInfo>([...history.movies, ...described]);
  const data: StatsDataset = {
    titles, played: history.played, measured: measured.history.entries, judgments: judged.judgments, epoch: measured.epoch,
  };

  // Les fiches TMDB des titres qui pèsent le plus, dans l'ordre du temps passé.
  const calendar = new LocalCalendar(timeZone);
  const overall = accumulate(data, periodWindow("all", calendar, now), calendar);
  const ranking = [...overall.byTitle.values()].sort((a, b) => secondsOf(b) - secondsOf(a)).map((t) => t.titleId);
  await enrichWithTmdb(titles, ranking);

  const periods = Object.fromEntries(
    VIEWING_STATS_PERIODS.map((p) => [p, computePeriod(data, p, calendar, now)])
  ) as Record<ViewingStatsPeriod, PeriodCore>;
  const cores = Object.values(periods);
  await Promise.all([
    decorateTitles(userId, cores.flatMap((c) => [...c.topSeries, ...c.movies])),
    attachPortraits(cores.flatMap((c) => [...c.people.actors, ...c.people.directors]), titles),
  ]);

  const counts = { ...judged.counts, favorites: history.favorites.ids.size };
  let taste: ViewingStatsTaste;
  try {
    taste = await readTaste(userId, counts, judged.judgments.ratings, libraryResolver(titles, history.favorites.byTmdbKey));
  } catch {
    taste = { available: false, computedAt: null, animeShare: 0, loved: [], signals: counts };
  }
  const heardSince = listeningSince(data.measured);

  return {
    timeZone,
    generatedAt: new Date(now).toISOString(),
    measuredSince: measured.epoch === null ? null : new Date(measured.epoch).toISOString(),
    listeningSince: heardSince === null ? null : new Date(heardSince).toISOString(),
    hasHistory: history.played.length > 0 || measured.history.entries.length > 0,
    periods,
    taste,
  };
}

export interface ViewingStatsRequest {
  period: ViewingStatsPeriod;
  timeZone: string;
  lang: StatsLang;
  /** « Tirer pour rafraîchir » : recalcule si le résultat a plus de 30 s. */
  refresh: boolean;
}

/**
 * Les statistiques d'une période. Deux demandes simultanées du même compte
 * (deux périodes, deux onglets) ne déclenchent qu'un seul calcul.
 */
export async function getViewingStats(userId: string, req: ViewingStatsRequest): Promise<ViewingStats> {
  const key = `${userId}|${req.timeZone}`;
  const cached = cache.get(key);
  const age = cached ? Date.now() - cached.at : Infinity;
  const stale = age >= TTL_MS || (req.refresh && age >= REFRESH_MIN_MS);
  if (cached && !stale) return presentStats(cached.value, req.period, req.lang);

  let pending = inFlight.get(key);
  if (!pending) {
    pending = compute(userId, req.timeZone)
      .then((value) => {
        const entry = { value, at: Date.now() };
        remember(key, entry);
        return entry;
      })
      .finally(() => inFlight.delete(key));
    inFlight.set(key, pending);
  }
  const entry = await pending;
  return presentStats(entry.value, req.period, req.lang);
}

/** Pour les tests : oublie tout ce qui est en cache. */
export function clearViewingStatsCache(): void {
  cache.clear();
  inFlight.clear();
}
