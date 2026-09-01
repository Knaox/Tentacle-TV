import { getPrisma } from "../db";
import { tmdbConfigured, tmdbFetch } from "./client";

/** Métadonnées normalisées d'un titre, prêtes pour l'extraction de facettes. */
export interface TitleMeta {
  mediaType: "movie" | "tv";
  tmdbId: number;
  title: string;
  genres: Array<{ id: number; name: string }>;
  keywords: Array<{ id: number; name: string }>;
  /// Films : job « Director » du crew. Séries : created_by.
  directors: number[];
  topCast: number[];
  studios: number[];
  networks: number[];
  year: number | null;
  originalLanguage: string | null;
  runtimeMinutes: number | null;
  popularity: number | null;
  voteAverage: number | null;
  voteCount: number | null;
}

// Les métadonnées d'un titre ne changent quasiment jamais : 30 jours, avec un
// étalement pour que tout le cache n'expire pas la même nuit.
const TTL_MS = 30 * 24 * 3600_000;
const TTL_JITTER_MS = 3 * 24 * 3600_000;

interface RawTmdbTitle {
  id: number;
  title?: string;
  name?: string;
  genres?: Array<{ id: number; name: string }>;
  keywords?: { keywords?: Array<{ id: number; name: string }>; results?: Array<{ id: number; name: string }> };
  credits?: {
    cast?: Array<{ id: number; order?: number }>;
    crew?: Array<{ id: number; job?: string }>;
  };
  created_by?: Array<{ id: number }>;
  production_companies?: Array<{ id: number }>;
  networks?: Array<{ id: number }>;
  release_date?: string;
  first_air_date?: string;
  original_language?: string;
  runtime?: number;
  episode_run_time?: number[];
  popularity?: number;
  vote_average?: number;
  vote_count?: number;
}

function normalize(mediaType: "movie" | "tv", raw: RawTmdbTitle): TitleMeta {
  const date = raw.release_date || raw.first_air_date || "";
  const year = /^\d{4}/.test(date) ? Number(date.slice(0, 4)) : null;
  const directors =
    mediaType === "movie"
      ? (raw.credits?.crew ?? []).filter((c) => c.job === "Director").map((c) => c.id)
      : (raw.created_by ?? []).map((c) => c.id);
  const topCast = (raw.credits?.cast ?? [])
    .slice()
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99))
    .slice(0, 5)
    .map((c) => c.id);
  // `/movie/{id}` livre keywords.keywords, `/tv/{id}` livre keywords.results.
  const keywords = raw.keywords?.keywords ?? raw.keywords?.results ?? [];
  return {
    mediaType,
    tmdbId: raw.id,
    title: raw.title ?? raw.name ?? "",
    genres: raw.genres ?? [],
    keywords,
    directors: [...new Set(directors)],
    topCast,
    studios: (raw.production_companies ?? []).map((c) => c.id),
    networks: (raw.networks ?? []).map((n) => n.id),
    year,
    originalLanguage: raw.original_language ?? null,
    runtimeMinutes: raw.runtime ?? raw.episode_run_time?.[0] ?? null,
    popularity: raw.popularity ?? null,
    voteAverage: raw.vote_average ?? null,
    voteCount: raw.vote_count ?? null,
  };
}

/** Lit le cache sans jamais appeler TMDB (null si absent ou périmé). */
export async function getCachedMeta(
  mediaType: "movie" | "tv",
  tmdbId: number
): Promise<TitleMeta | null> {
  const prisma = getPrisma();
  const row = await prisma.tmdbMetaCache.findUnique({
    where: { mediaType_tmdbId: { mediaType, tmdbId } },
  });
  if (!row || row.expiresAt.getTime() < Date.now()) return null;
  try {
    return normalize(mediaType, JSON.parse(row.payload) as RawTmdbTitle);
  } catch {
    return null;
  }
}

/**
 * Métadonnées d'un titre : cache d'abord, sinon UN appel TMDB
 * (`append_to_response=keywords,credits` — détails, mots-clés et casting en une
 * seule requête). Rend null si TMDB n'est pas configuré ou en échec : le
 * moteur dégrade sur les facettes Jellyfin, il ne casse pas.
 */
export async function getTitleMeta(
  mediaType: "movie" | "tv",
  tmdbId: number
): Promise<TitleMeta | null> {
  const cached = await getCachedMeta(mediaType, tmdbId);
  if (cached) return cached;
  if (!tmdbConfigured()) return null;

  try {
    const raw = await tmdbFetch<RawTmdbTitle>(`/${mediaType}/${tmdbId}`, {
      append_to_response: "keywords,credits",
    });
    const prisma = getPrisma();
    const expiresAt = new Date(Date.now() + TTL_MS + Math.random() * TTL_JITTER_MS);
    await prisma.tmdbMetaCache.upsert({
      where: { mediaType_tmdbId: { mediaType, tmdbId } },
      create: { mediaType, tmdbId, payload: JSON.stringify(raw), expiresAt },
      update: { payload: JSON.stringify(raw), fetchedAt: new Date(), expiresAt },
    });
    return normalize(mediaType, raw);
  } catch {
    return null;
  }
}

/** Parcourt tout le cache et rend les métadonnées normalisées (job IDF). */
export async function getAllCachedMeta(): Promise<TitleMeta[]> {
  const prisma = getPrisma();
  const rows = await prisma.tmdbMetaCache.findMany({
    select: { mediaType: true, tmdbId: true, payload: true },
  });
  const out: TitleMeta[] = [];
  for (const row of rows) {
    try {
      out.push(normalize(row.mediaType as "movie" | "tv", JSON.parse(row.payload) as RawTmdbTitle));
    } catch {
      // Ligne illisible : on l'ignore, le prochain fetch la réécrira.
    }
  }
  return out;
}
