import { getPrisma } from "../db";
import { tmdbConfigured, tmdbFetch } from "./client";
import type { TmdbPriority } from "./client";
import { normalizeProviders, watchRegion } from "./providerNormalize";
import type { ProviderRef, RawWatchProvidersBlock } from "./providerNormalize";

// Le type des plateformes vit désormais dans providerNormalize ; ré-exporté
// pour les importeurs historiques (rowBuilder, providerDirectory…).
export type { ProviderRef } from "./providerNormalize";

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
  /** Pays d'origine ISO 3166-1 (films ET séries) — l'indice « animé » quand
   *  la langue ment (coproduction doublée en anglais). */
  originCountry: string[];
  runtimeMinutes: number | null;
  popularity: number | null;
  voteAverage: number | null;
  voteCount: number | null;
  posterPath: string | null;
  backdropPath: string | null;
  /** Plateformes de la région configurée — null = ligne d'AVANT la clé
   *  watch/providers (« inconnu »), [] = aucune offre incluse. */
  providers: ProviderRef[] | null;
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
  origin_country?: string[];
  production_countries?: Array<{ iso_3166_1?: string }>;
  runtime?: number;
  episode_run_time?: number[];
  popularity?: number;
  vote_average?: number;
  vote_count?: number;
  poster_path?: string | null;
  backdrop_path?: string | null;
  // Clé LITTÉRALE avec slash — c'est la forme de l'API TMDB.
  "watch/providers"?: RawWatchProvidersBlock;
}

/** `origin_country` (films ET séries), sinon les pays de production. */
function originCountryOf(raw: RawTmdbTitle): string[] {
  if (raw.origin_country?.length) return raw.origin_country;
  return (raw.production_countries ?? []).map((c) => c.iso_3166_1 ?? "").filter(Boolean);
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
    originCountry: originCountryOf(raw),
    runtimeMinutes: raw.runtime ?? raw.episode_run_time?.[0] ?? null,
    popularity: raw.popularity ?? null,
    voteAverage: raw.vote_average ?? null,
    voteCount: raw.vote_count ?? null,
    posterPath: raw.poster_path ?? null,
    // Rétroactif : les fiches `/movie|tv/{id}` en cache portent déjà le champ.
    backdropPath: raw.backdrop_path ?? null,
    // Région résolue à la LECTURE : changer de région ne demande aucun refetch.
    providers: normalizeProviders(raw["watch/providers"], watchRegion()),
  };
}

/** Le payload brut en cache, ou null (absent, périmé, illisible). */
async function readCachedRaw(
  mediaType: "movie" | "tv",
  tmdbId: number
): Promise<RawTmdbTitle | null> {
  const prisma = getPrisma();
  const row = await prisma.tmdbMetaCache.findUnique({
    where: { mediaType_tmdbId: { mediaType, tmdbId } },
  });
  if (!row || row.expiresAt.getTime() < Date.now()) return null;
  try {
    return JSON.parse(row.payload) as RawTmdbTitle;
  } catch {
    return null;
  }
}

/** Lit le cache sans jamais appeler TMDB (null si absent ou périmé). */
export async function getCachedMeta(
  mediaType: "movie" | "tv",
  tmdbId: number
): Promise<TitleMeta | null> {
  const raw = await readCachedRaw(mediaType, tmdbId);
  return raw ? normalize(mediaType, raw) : null;
}

/** Clé des lectures groupées (« movie:603 ») — même forme que les clés du pool. */
export function metaKey(mediaType: "movie" | "tv", tmdbId: number): string {
  return `${mediaType}:${tmdbId}`;
}

/**
 * Lecture groupée du cache, jamais d'appel TMDB : UNE requête par tranche de
 * 400 identités au lieu d'une par titre. Une ligne périmée ou illisible est
 * simplement absente de la carte rendue — comme pour getCachedMeta.
 */
export async function getCachedMetaMany(
  refs: Array<{ mediaType: "movie" | "tv"; tmdbId: number }>
): Promise<Map<string, TitleMeta>> {
  const out = new Map<string, TitleMeta>();
  if (refs.length === 0) return out;
  const prisma = getPrisma();
  const now = Date.now();
  // Dédup en amont : plusieurs signaux visent souvent le même titre.
  const wanted = new Map<string, { mediaType: "movie" | "tv"; tmdbId: number }>();
  for (const ref of refs) wanted.set(metaKey(ref.mediaType, ref.tmdbId), ref);
  const all = [...wanted.values()];
  const CHUNK = 400; // borne la taille du OR généré côté MariaDB
  for (let i = 0; i < all.length; i += CHUNK) {
    const chunk = all.slice(i, i + CHUNK);
    const rows = await prisma.tmdbMetaCache.findMany({
      where: { OR: chunk.map((r) => ({ mediaType: r.mediaType, tmdbId: r.tmdbId })) },
    });
    for (const row of rows) {
      if (row.expiresAt.getTime() < now) continue;
      try {
        const mediaType = row.mediaType as "movie" | "tv";
        out.set(metaKey(mediaType, row.tmdbId), normalize(mediaType, JSON.parse(row.payload) as RawTmdbTitle));
      } catch {
        // Ligne illisible : absente de la carte, le prochain fetch la réécrira.
      }
    }
  }
  return out;
}

/**
 * Métadonnées d'un titre : cache d'abord, sinon UN appel TMDB
 * (`append_to_response=keywords,credits,watch/providers` — détails, mots-clés,
 * casting et plateformes en une seule requête). Rend null si TMDB n'est pas
 * configuré ou en échec : le moteur dégrade sur les facettes Jellyfin.
 *
 * Invalidation DOUCE : une ligne d'avant la clé watch/providers vaut un
 * défaut de cache — refetch sous les budgets existants, le cache de 30 jours
 * se met à niveau progressivement, top titres d'abord.
 */
export async function getTitleMeta(
  mediaType: "movie" | "tv",
  tmdbId: number,
  opts: { priority?: TmdbPriority } = {}
): Promise<TitleMeta | null> {
  const cached = await readCachedRaw(mediaType, tmdbId);
  if (cached && "watch/providers" in cached) return normalize(mediaType, cached);
  if (!tmdbConfigured()) return cached ? normalize(mediaType, cached) : null;

  try {
    const raw = await tmdbFetch<RawTmdbTitle>(
      `/${mediaType}/${tmdbId}`,
      { append_to_response: "keywords,credits,watch/providers" },
      { priority: opts.priority }
    );
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
