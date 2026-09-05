import { readGlobalCache, writeGlobalCache } from "../globalCacheStore";
import { tmdbConfigured, tmdbFetch } from "./client";
import type { TmdbPriority } from "./client";

/** Note TMDB d'un épisode : `vote_average` sur 10, null tant que personne n'a voté. */
export interface SeasonEpisodeRating {
  episodeNumber: number;
  voteAverage: number | null;
  voteCount: number;
}

export interface SeasonEpisodes {
  tmdbId: number;
  seasonNumber: number;
  episodes: SeasonEpisodeRating[];
  /** ISO — la fraîcheur se juge sur le payload, jamais sur la ligne. */
  fetchedAt: string;
}

/** Une journée : les votes d'un épisode bougent lentement, surtout à sa diffusion. */
const FRESH_MS = 24 * 3600_000;
/** Trente jours sur disque : une copie périmée est servie pendant qu'on relit. */
const DISK_TTL_MS = 30 * 24 * 3600_000;
const MEMORY_MAX = 500;

const memory = new Map<string, SeasonEpisodes>();
const inFlight = new Map<string, Promise<SeasonEpisodes | null>>();

/** Clé de la ligne globale — tient dans le VarChar(64) de recommendation_cache. */
function keyOf(tmdbId: number, seasonNumber: number): string {
  return `tmdbSeason:${tmdbId}:${seasonNumber}`;
}

export function isSeasonFresh(entry: SeasonEpisodes, now = Date.now()): boolean {
  const at = Date.parse(entry.fetchedAt);
  return Number.isFinite(at) && now - at < FRESH_MS;
}

/**
 * Normalise la réponse brute de `GET /tv/{id}/season/{n}` — tolérante et pure :
 * un épisode sans numéro entier est ignoré, un épisode sans vote a une note
 * nulle (jamais 0, qui se lirait comme une note), la moyenne est arrondie au
 * dixième, la liste rendue triée par numéro.
 */
export function normalizeSeasonEpisodes(raw: unknown): SeasonEpisodeRating[] {
  const list = (raw as { episodes?: unknown } | null)?.episodes;
  if (!Array.isArray(list)) return [];
  const out: SeasonEpisodeRating[] = [];
  for (const entry of list) {
    const ep = entry as { episode_number?: unknown; vote_average?: unknown; vote_count?: unknown } | null;
    const n = Number(ep?.episode_number);
    if (!Number.isInteger(n) || n < 0) continue;
    const count = Number(ep?.vote_count);
    const voteCount = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
    const avg = Number(ep?.vote_average);
    const voteAverage = voteCount > 0 && Number.isFinite(avg) && avg > 0 ? Math.round(avg * 10) / 10 : null;
    out.push({ episodeNumber: n, voteAverage, voteCount });
  }
  return out.sort((a, b) => a.episodeNumber - b.episodeNumber);
}

/** Mémoire bornée, la plus ancienne clé sort la première. */
function remember(key: string, entry: SeasonEpisodes): SeasonEpisodes {
  memory.delete(key);
  memory.set(key, entry);
  if (memory.size > MEMORY_MAX) {
    const oldest = memory.keys().next().value;
    if (oldest !== undefined) memory.delete(oldest);
  }
  return entry;
}

async function fetchSeason(
  tmdbId: number,
  seasonNumber: number,
  priority: TmdbPriority
): Promise<SeasonEpisodes | null> {
  try {
    const raw = await tmdbFetch<unknown>(`/tv/${tmdbId}/season/${seasonNumber}`, {}, { priority });
    const entry: SeasonEpisodes = {
      tmdbId,
      seasonNumber,
      episodes: normalizeSeasonEpisodes(raw),
      fetchedAt: new Date().toISOString(),
    };
    await writeGlobalCache(keyOf(tmdbId, seasonNumber), entry, DISK_TTL_MS).catch(() => undefined);
    return entry;
  } catch {
    return null;
  }
}

/**
 * Les notes TMDB des épisodes d'une saison : mémoire → disque (une copie
 * périmée est servie si TMDB ne répond pas) → TMDB. Un seul appel en vol par
 * saison. Jamais d'exception : null quand rien n'est connu.
 */
export async function getSeasonEpisodes(
  tmdbId: number,
  seasonNumber: number,
  opts: { priority?: TmdbPriority } = {}
): Promise<SeasonEpisodes | null> {
  const key = keyOf(tmdbId, seasonNumber);
  const hot = memory.get(key);
  if (hot && isSeasonFresh(hot)) return hot;
  const pending = inFlight.get(key);
  if (pending) return pending;

  const task = (async () => {
    const disk =
      hot ?? (await readGlobalCache<SeasonEpisodes>(key).catch(() => null))?.payload ?? null;
    if (disk && isSeasonFresh(disk)) return remember(key, disk);
    if (!tmdbConfigured()) return disk ? remember(key, disk) : null;
    const fresh = await fetchSeason(tmdbId, seasonNumber, opts.priority ?? "interactive");
    if (fresh) return remember(key, fresh);
    return disk ? remember(key, disk) : null;
  })().finally(() => inFlight.delete(key));
  inFlight.set(key, task);
  return task;
}

export function resetSeasonEpisodesForTests(): void {
  memory.clear();
  inFlight.clear();
}
