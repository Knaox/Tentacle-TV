import { getPrisma } from "../db";
import { tmdbConfigured, tmdbFetch } from "./client";

export interface NamedRef {
  id: number;
  name: string;
}

/**
 * Métadonnées normalisées d'un titre, prêtes pour l'extraction de facettes.
 * Les personnes/studios gardent leur NOM : c'est lui qui fabrique les raisons
 * lisibles de l'UI (« Réalisé par Denis Villeneuve »).
 */
export interface TitleMeta {
  mediaType: "movie" | "tv";
  tmdbId: number;
  title: string;
  genres: NamedRef[];
  keywords: NamedRef[];
  /// Films : job « Director » du crew. Séries : created_by.
  directors: NamedRef[];
  topCast: NamedRef[];
  studios: NamedRef[];
  networks: NamedRef[];
  year: number | null;
  originalLanguage: string | null;
  runtimeMinutes: number | null;
  popularity: number | null;
  voteAverage: number | null;
  voteCount: number | null;
  posterPath: string | null;
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
    cast?: Array<{ id: number; name?: string; order?: number }>;
    crew?: Array<{ id: number; name?: string; job?: string }>;
  };
  created_by?: Array<{ id: number; name?: string }>;
  production_companies?: Array<{ id: number; name?: string }>;
  networks?: Array<{ id: number; name?: string }>;
  release_date?: string;
  first_air_date?: string;
  original_language?: string;
  runtime?: number;
  episode_run_time?: number[];
  popularity?: number;
  vote_average?: number;
  vote_count?: number;
  poster_path?: string | null;
}

function named(refs: Array<{ id: number; name?: string }>): NamedRef[] {
  const seen = new Set<number>();
  const out: NamedRef[] = [];
  for (const r of refs) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    out.push({ id: r.id, name: r.name ?? "" });
  }
  return out;
}

function normalize(mediaType: "movie" | "tv", raw: RawTmdbTitle): TitleMeta {
  const date = raw.release_date || raw.first_air_date || "";
  const year = /^\d{4}/.test(date) ? Number(date.slice(0, 4)) : null;
  const directors =
    mediaType === "movie"
      ? (raw.credits?.crew ?? []).filter((c) => c.job === "Director")
      : (raw.created_by ?? []);
  const topCast = (raw.credits?.cast ?? [])
    .slice()
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99))
    .slice(0, 5);
  // `/movie/{id}` livre keywords.keywords, `/tv/{id}` livre keywords.results.
  const keywords = raw.keywords?.keywords ?? raw.keywords?.results ?? [];
  return {
    mediaType,
    tmdbId: raw.id,
    title: raw.title ?? raw.name ?? "",
    genres: raw.genres ?? [],
    keywords,
    directors: named(directors),
    topCast: named(topCast),
    studios: named(raw.production_companies ?? []),
    networks: named(raw.networks ?? []),
    year,
    originalLanguage: raw.original_language ?? null,
    runtimeMinutes: raw.runtime ?? raw.episode_run_time?.[0] ?? null,
    popularity: raw.popularity ?? null,
    voteAverage: raw.vote_average ?? null,
    voteCount: raw.vote_count ?? null,
    posterPath: raw.poster_path ?? null,
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
