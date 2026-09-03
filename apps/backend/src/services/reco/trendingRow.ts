import { getPrisma } from "../db";
import { tmdbConfigured, tmdbFetch } from "../tmdb/client";
import { getSeerrConfig } from "../seerConfig";
import { getLibraryIndexMemo } from "./candidates/libraryMemo";
import type { BuiltRow, RecoRowItem } from "./rowBuilder";

/**
 * Rangée « Tendances » : servie à TOUS les comptes, quel que soit l'état du
 * profil (générique, froid, riche). La matière est GLOBALE au serveur — une
 * sentinelle dans recommendation_cache, jamais une ligne par compte — et
 * l'habillage (résolution bibliothèque, exclusions) se fait au service.
 */
export const TRENDING_ROW_KEY = "trending";

// Le compte sentinelle des caches globaux vit dans globalCacheStore ;
// ré-exporté pour les importeurs historiques (serverPulse).
import { GLOBAL_CACHE_USER_ID } from "../globalCacheStore";
export { GLOBAL_CACHE_USER_ID };

/** TTL 48 h pour un refresh 12 h : la purge horaire ne tue jamais la ligne
 *  entre deux passages — du « stale-while-refresh » gratuit. */
const TRENDING_TTL_MS = 48 * 3600_000;
const TRENDING_MAX = 30;
const VIGIE_PAGES = 2;
const VIGIE_TIMEOUT_MS = 8_000;

interface TrendingSlim {
  key: string;
  mediaType: "movie" | "tv";
  tmdbId: number;
  title: string;
  year: number | null;
  posterPath: string | null;
  backdropPath: string | null;
  voteAverage: number | null;
  popularity: number | null;
}

interface TrendingPayload {
  computedAt: string;
  origin: "tmdb" | "vigie";
  items: TrendingSlim[];
}

// TMDB nu répond en snake_case (contrairement à Jellyseerr).
interface TmdbTrendingResult {
  id: number;
  title?: string;
  name?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  vote_average?: number;
  popularity?: number;
  release_date?: string;
  first_air_date?: string;
}

interface SeerrTrendingResult {
  id: number;
  mediaType?: "movie" | "tv" | "person";
  title?: string;
  name?: string;
  posterPath?: string | null;
  backdropPath?: string | null;
  voteAverage?: number;
  popularity?: number;
  releaseDate?: string;
  firstAirDate?: string;
}

function yearOf(date: string | undefined): number | null {
  return date && /^\d{4}/.test(date) ? Number(date.slice(0, 4)) : null;
}

function fromTmdb(raw: TmdbTrendingResult, mediaType: "movie" | "tv"): TrendingSlim {
  return {
    key: `${mediaType}:${raw.id}`,
    mediaType,
    tmdbId: raw.id,
    title: raw.title ?? raw.name ?? "",
    year: yearOf(raw.release_date || raw.first_air_date),
    posterPath: raw.poster_path ?? null,
    backdropPath: raw.backdrop_path ?? null,
    voteAverage: raw.vote_average ?? null,
    popularity: raw.popularity ?? null,
  };
}

async function trendingFromTmdb(): Promise<TrendingSlim[]> {
  const [movies, tv] = await Promise.all([
    tmdbFetch<{ results?: TmdbTrendingResult[] }>("/trending/movie/week", {}, { priority: "background" }),
    tmdbFetch<{ results?: TmdbTrendingResult[] }>("/trending/tv/week", {}, { priority: "background" }),
  ]);
  // Entrelacement film/série : la rangée mélange les deux mondes au lieu
  // d'empiler vingt films puis dix séries.
  const a = (movies.results ?? []).map((r) => fromTmdb(r, "movie"));
  const b = (tv.results ?? []).map((r) => fromTmdb(r, "tv"));
  const out: TrendingSlim[] = [];
  for (let i = 0; out.length < TRENDING_MAX && (i < a.length || i < b.length); i++) {
    if (i < a.length) out.push(a[i]);
    if (i < b.length && out.length < TRENDING_MAX) out.push(b[i]);
  }
  // Jamais de carte muette : sans affiche TMDB, le titre ne sort pas.
  return out.filter((t) => t.title && t.posterPath);
}

async function trendingFromVigie(url: string, apiKey: string): Promise<TrendingSlim[]> {
  const out: TrendingSlim[] = [];
  for (let page = 1; page <= VIGIE_PAGES && out.length < TRENDING_MAX; page++) {
    const res = await fetch(`${url}/api/v1/discover/trending?page=${page}`, {
      headers: { "X-Api-Key": apiKey },
      signal: AbortSignal.timeout(VIGIE_TIMEOUT_MS),
    });
    if (!res.ok) break;
    const data = (await res.json()) as { results?: SeerrTrendingResult[] };
    for (const raw of data.results ?? []) {
      if (raw.mediaType !== "movie" && raw.mediaType !== "tv") continue;
      const title = raw.title ?? raw.name ?? "";
      if (!title || !raw.posterPath) continue;
      out.push({
        key: `${raw.mediaType}:${raw.id}`,
        mediaType: raw.mediaType,
        tmdbId: raw.id,
        title,
        year: yearOf(raw.releaseDate || raw.firstAirDate),
        posterPath: raw.posterPath,
        backdropPath: raw.backdropPath ?? null,
        voteAverage: raw.voteAverage ?? null,
        popularity: raw.popularity ?? null,
      });
      if (out.length >= TRENDING_MAX) break;
    }
  }
  return out;
}

/**
 * Rafraîchit la sentinelle : TMDB `/trending/{movie,tv}/week` si la clé est là
 * (2 appels, cadencés par l'espaceur global), sinon Jellyseerr via le plugin
 * Vigie (il a sa propre clé), sinon rien — dégradation silencieuse, comme partout.
 */
export async function refreshTrending(): Promise<{ count: number; origin: string } | null> {
  let items: TrendingSlim[] = [];
  let origin: TrendingPayload["origin"];
  if (tmdbConfigured()) {
    origin = "tmdb";
    items = await trendingFromTmdb();
  } else {
    const seerr = getSeerrConfig();
    if (!seerr) return null;
    origin = "vigie";
    items = await trendingFromVigie(seerr.url, seerr.apiKey);
  }
  if (items.length === 0) return null;

  const payload: TrendingPayload = { computedAt: new Date().toISOString(), origin, items };
  const prisma = getPrisma();
  await prisma.recommendationCache.upsert({
    where: {
      jellyfinUserId_rowKey: { jellyfinUserId: GLOBAL_CACHE_USER_ID, rowKey: TRENDING_ROW_KEY },
    },
    create: {
      jellyfinUserId: GLOBAL_CACHE_USER_ID,
      rowKey: TRENDING_ROW_KEY,
      payload: JSON.stringify(payload),
      expiresAt: new Date(Date.now() + TRENDING_TTL_MS),
    },
    update: {
      payload: JSON.stringify(payload),
      generatedAt: new Date(),
      expiresAt: new Date(Date.now() + TRENDING_TTL_MS),
    },
  });
  return { count: items.length, origin };
}

async function readTrendingPayload(): Promise<TrendingPayload | null> {
  const prisma = getPrisma();
  const row = await prisma.recommendationCache.findUnique({
    where: {
      jellyfinUserId_rowKey: { jellyfinUserId: GLOBAL_CACHE_USER_ID, rowKey: TRENDING_ROW_KEY },
    },
  });
  if (!row || row.expiresAt.getTime() < Date.now()) return null;
  try {
    return JSON.parse(row.payload) as TrendingPayload;
  } catch {
    return null;
  }
}

/**
 * Sert la rangée pour UN compte : lecture seule, zéro réseau (doctrine
 * communityRow). Sentinelle absente → `pending: true`, le client re-sonde et
 * le job de boot remplit. Exclusions du moment + titres déjà vus/entamés/
 * favoris : une tendance n'est une découverte que si on ne la connaît pas.
 */
export async function buildTrendingRow(
  userId: string,
  ctx: { exclude: ReadonlySet<string>; includeVigie: boolean }
): Promise<BuiltRow & { pending?: boolean }> {
  const payload = await readTrendingPayload();
  if (!payload) {
    return { key: TRENDING_ROW_KEY, items: [], generatedAt: new Date().toISOString(), pending: true };
  }
  const library = await getLibraryIndexMemo(userId);
  const items: RecoRowItem[] = [];
  for (const [i, slim] of payload.items.entries()) {
    if (ctx.exclude.has(slim.key)) continue;
    const entry = library.byKey.get(slim.key);
    if (entry && (entry.played || entry.inProgress || entry.isFavorite)) continue;
    // « Bibliothèque seule » fait foi : hors bibliothèque, le titre ne sort pas.
    if (!ctx.includeVigie && !entry) continue;
    items.push({
      key: slim.key,
      mediaType: slim.mediaType,
      tmdbId: slim.tmdbId,
      title: slim.title,
      year: slim.year,
      posterPath: slim.posterPath,
      backdropPath: slim.backdropPath,
      jellyfinItemId: entry?.itemId ?? null,
      source: "trending",
      score: slim.popularity ?? payload.items.length - i,
      voteAverage: slim.voteAverage,
      reasons: [],
    });
  }
  return { key: TRENDING_ROW_KEY, items, generatedAt: payload.computedAt };
}
