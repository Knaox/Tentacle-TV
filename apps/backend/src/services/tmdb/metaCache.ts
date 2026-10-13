import { getPrisma } from "../db";
import { tmdbConfigured, tmdbFetch } from "./client";
import type { TmdbPriority } from "./client";
import { normalizeProviders, watchRegion } from "./providerNormalize";
import type { ProviderRef, RawWatchProvidersBlock } from "./providerNormalize";
import { neighborsOf, slimRecommendations } from "./titleNeighbors";
import type { RawRecommendations, TitleNeighbor } from "./titleNeighbors";

// Le type des plateformes vit désormais dans providerNormalize ; ré-exporté
// pour les importeurs historiques (rowBuilder, providerDirectory…).
export type { ProviderRef } from "./providerNormalize";

export interface NamedRef {
  id: number;
  name: string;
  /** Portrait TMDB d'une personne du casting (suggestions « Vos acteurs ») ; absent ailleurs. */
  profilePath?: string | null;
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
  /** Date de sortie (film) ou de première diffusion (série), « AAAA-MM-JJ ». */
  releaseDate?: string | null;
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
  /** Voisins collaboratifs TMDB (ordre de la liste) — null ou absent = ligne
   *  d'avant la clé `recommendations`. */
  recommendations?: TitleNeighbor[] | null;
  /** La saga TMDB d'un film (`belongs_to_collection`) ; null = aucune (ou une série). */
  collection?: { id: number; name: string } | null;
  /** Titre pour adultes selon TMDB. */
  adult?: boolean;
  /** Séries : épisodes diffusés — le FORMAT (feuilleton-fleuve). */
  episodeCount?: number | null;
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
    cast?: Array<{ id: number; name?: string; order?: number; profile_path?: string | null }>;
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
  number_of_episodes?: number;
  popularity?: number;
  vote_average?: number;
  vote_count?: number;
  poster_path?: string | null;
  backdrop_path?: string | null;
  // Clé LITTÉRALE avec slash — c'est la forme de l'API TMDB.
  "watch/providers"?: RawWatchProvidersBlock;
  /** Réduit aux ids avant stockage (cf. titleNeighbors). */
  recommendations?: RawRecommendations;
  /** Film seulement : la saga dont il fait partie (déjà dans les fiches en cache). */
  belongs_to_collection?: { id: number; name?: string } | null;
  adult?: boolean;
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
    topCast: named(topCast).map((p) => ({ ...p, profilePath: topCast.find((c) => c.id === p.id)?.profile_path ?? null })),
    studios: named(raw.production_companies ?? []),
    networks: named(raw.networks ?? []),
    year,
    releaseDate: date || null,
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
    recommendations: neighborsOf(raw.recommendations, mediaType),
    collection: raw.belongs_to_collection?.id
      ? { id: raw.belongs_to_collection.id, name: raw.belongs_to_collection.name ?? "" }
      : null,
    adult: raw.adult === true,
    // Rétroactif aussi : la fiche brute en cache porte déjà le champ.
    episodeCount: raw.number_of_episodes ?? null,
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
 * simplement absente de la carte rendue — comme pour getCachedMeta — sauf
 * `includeExpired` : les statistiques n'y lisent que des faits qui ne
 * bougent pas (genres, pays, casting), et le moteur rafraîchit à son rythme.
 */
export async function getCachedMetaMany(
  refs: Array<{ mediaType: "movie" | "tv"; tmdbId: number }>,
  opts: { includeExpired?: boolean } = {}
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
      if (!opts.includeExpired && row.expiresAt.getTime() < now) continue;
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
 * (`append_to_response=keywords,credits,watch/providers,recommendations` —
 * détails, mots-clés, casting, plateformes et voisins collaboratifs en une
 * seule requête). Rend null si TMDB n'est pas configuré ou en échec : le
 * moteur dégrade sur les facettes Jellyfin.
 *
 * Invalidation DOUCE : une ligne d'avant la clé watch/providers vaut un
 * défaut de cache — refetch sous les budgets existants, le cache de 30 jours
 * se met à niveau progressivement, top titres d'abord. Une ligne sans
 * `recommendations` reste servie telle quelle, sauf `upgrade` : le profil de
 * goût paie ce refetch pour ses titres forts (sous son budget).
 */
export async function getTitleMeta(
  mediaType: "movie" | "tv",
  tmdbId: number,
  opts: { priority?: TmdbPriority; upgrade?: boolean } = {}
): Promise<TitleMeta | null> {
  const cached = await readCachedRaw(mediaType, tmdbId);
  const upToDate = cached && "watch/providers" in cached && (!opts.upgrade || "recommendations" in cached);
  if (cached && upToDate) return normalize(mediaType, cached);
  if (!tmdbConfigured()) return cached ? normalize(mediaType, cached) : null;

  try {
    const raw = await tmdbFetch<RawTmdbTitle>(
      `/${mediaType}/${tmdbId}`,
      { append_to_response: "keywords,credits,watch/providers,recommendations" },
      { priority: opts.priority }
    );
    raw.recommendations = slimRecommendations(raw.recommendations, mediaType);
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
  const out: TitleMeta[] = [];
  // Par pages : d'un bloc, 12 000 fiches brutes (~50 Ko chacune) dépassent la plus
  // longue chaîne que le moteur de Prisma sait rendre à Node — le recalcul de l'IDF
  // échouait (« Failed to convert rust String into napi string »).
  for (let skip = 0; ; skip += ALL_META_PAGE) {
    const rows = await prisma.tmdbMetaCache.findMany({
      select: { mediaType: true, tmdbId: true, payload: true },
      orderBy: [{ mediaType: "asc" }, { tmdbId: "asc" }],
      skip,
      take: ALL_META_PAGE,
    });
    for (const row of rows) {
      try {
        out.push(normalize(row.mediaType as "movie" | "tv", JSON.parse(row.payload) as RawTmdbTitle));
      } catch {
        // Ligne illisible : on l'ignore, le prochain fetch la réécrira.
      }
    }
    if (rows.length < ALL_META_PAGE) break;
  }
  return out;
}

const ALL_META_PAGE = 500;
