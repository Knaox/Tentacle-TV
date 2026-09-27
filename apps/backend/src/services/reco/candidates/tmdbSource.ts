import { tmdbConfigured, tmdbFetch } from "../../tmdb/client";
import type { TmdbFetchOptions } from "../../tmdb/client";

/** La génération est du FOND : les fiches et recherches interactives passent devant. */
const BACKGROUND: TmdbFetchOptions = { priority: "background" };
import { ANIME_UNIVERSE_KEY, decadeOf, isAnimeCoarse } from "../facets";
import type { FacetEntry } from "../facets";
import type { Candidate, TasteVector } from "../scoring/strategy";
import { cappedReleaseParams, isReleasedResult } from "./released";

/** Un titre-graine : un des 20-30 titres les plus forts du profil. */
export interface SeedRef {
  mediaType: "movie" | "tv";
  tmdbId: number;
  title: string;
  strength: number;
}

export interface TmdbListResult {
  id: number;
  title?: string;
  name?: string;
  genre_ids?: number[];
  vote_average?: number;
  vote_count?: number;
  popularity?: number;
  release_date?: string;
  first_air_date?: string;
  original_language?: string;
  origin_country?: string[];
  poster_path?: string | null;
  backdrop_path?: string | null;
}

interface TmdbListPage {
  results?: TmdbListResult[];
}

/**
 * Facettes GROSSIÈRES d'un résultat de liste TMDB (genres, décennie, langue) —
 * assez pour le pré-classement du pool ; le top est ensuite enrichi en
 * métadonnées complètes (keywords, casting) sous budget.
 */
function coarseFacets(raw: TmdbListResult): FacetEntry[] {
  const out: FacetEntry[] = [];
  for (const g of raw.genre_ids ?? []) out.push({ key: `genre:${g}`, mult: 1 });
  const date = raw.release_date || raw.first_air_date || "";
  if (/^\d{4}/.test(date)) out.push({ key: `decade:${decadeOf(Number(date.slice(0, 4)))}`, mult: 1 });
  if (raw.original_language) out.push({ key: `lang:${raw.original_language}`, mult: 1 });
  // L'univers dès la liste : un candidat animé se reconnaît AVANT enrichissement.
  if (isAnimeCoarse(raw.genre_ids ?? [], raw.original_language, raw.origin_country)) {
    out.push({ key: ANIME_UNIVERSE_KEY, mult: 1 });
  }
  return out;
}

export function toCandidate(
  raw: TmdbListResult,
  mediaType: "movie" | "tv",
  source: Candidate["source"]
): Candidate {
  const date = raw.release_date || raw.first_air_date || "";
  return {
    key: `${mediaType}:${raw.id}`,
    mediaType,
    tmdbId: raw.id,
    title: raw.title ?? raw.name ?? "",
    year: /^\d{4}/.test(date) ? Number(date.slice(0, 4)) : null,
    facets: coarseFacets(raw),
    voteAverage: raw.vote_average ?? null,
    voteCount: raw.vote_count ?? null,
    popularity: raw.popularity ?? null,
    source,
    posterPath: raw.poster_path ?? null,
    backdropPath: raw.backdrop_path ?? null,
  };
}

/** Nombre de graines qui reçoivent AUSSI un appel /similar (les plus fortes). */
const SIMILAR_SEEDS = 8;
/** /similar (mêmes genres et mots-clés) dit moins que /recommendations
 *  (mêmes spectateurs) : son soutien compte moitié. */
const SIMILAR_FACTOR = 0.5;
/** Un rang de 0 à 19 : le premier de la liste pèse deux fois le vingtième. */
const RANK_SPAN = 40;

/**
 * Candidats issus des graines : `/recommendations` pour chacune, `/similar`
 * pour les plus fortes. Chaque apparition porte un SOUTIEN (force de la graine
 * × rang dans la liste) que l'assemblage du pool cumule. Un échec de graine
 * est silencieux — le pool vit.
 */
export async function candidatesFromSeeds(seeds: SeedRef[]): Promise<Candidate[]> {
  if (!tmdbConfigured()) return [];
  const out: Candidate[] = [];

  for (const [index, seed] of seeds.entries()) {
    const paths = [`/${seed.mediaType}/${seed.tmdbId}/recommendations`];
    if (index < SIMILAR_SEEDS) paths.push(`/${seed.mediaType}/${seed.tmdbId}/similar`);
    for (const path of paths) {
      const factor = path.endsWith("/similar") ? SIMILAR_FACTOR : 1;
      try {
        const page = await tmdbFetch<TmdbListPage>(path, { page: "1" }, BACKGROUND);
        for (const [rank, raw] of (page.results ?? []).entries()) {
          // Sorti au minimum : /recommendations et /similar listent aussi l'annoncé.
          if (!isReleasedResult(raw)) continue;
          const candidate = toCandidate(raw, seed.mediaType, "tmdb_rec");
          // La graine signe son candidat : les rangées « Parce que vous avez
          // aimé [titre] » se découpent là-dessus.
          candidate.seedKey = `${seed.mediaType}:${seed.tmdbId}`;
          candidate.seedSupport = seed.strength * factor * (1 - rank / RANK_SPAN);
          out.push(candidate);
        }
      } catch {
        // Graine muette (titre retiré, réseau) : on continue.
      }
    }
  }
  return out;
}

/** Extrait les N ids numériques dominants d'un préfixe de facette du profil. */
function topIds(profile: TasteVector, prefix: string, count: number): number[] {
  return Object.entries(profile.facets)
    .filter(([key, weight]) => key.startsWith(prefix) && weight > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([key]) => Number(key.slice(prefix.length)))
    .filter((n) => Number.isFinite(n));
}

function topDecades(profile: TasteVector, count: number): number[] {
  return Object.entries(profile.facets)
    .filter(([key, weight]) => key.startsWith("decade:") && weight > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([key]) => Number(key.slice("decade:".length)))
    .filter((n) => Number.isFinite(n) && n > 1900);
}

/** Bruit minimal exigé : sous 200 votes, un titre de /discover est du bruit. */
const DISCOVER_MIN_VOTES = "200";

// Les genres TMDB des films et des séries n'ont pas les mêmes ids (Action 28
// ↔ Action & Adventure 10759…) : un profil qui mêle les deux interrogeait
// /discover/tv avec des genres de film, que TMDB ignore.
const MOVIE_TO_TV: Readonly<Record<number, number>> = { 28: 10759, 12: 10759, 878: 10765, 14: 10765, 10752: 10768 };
const TV_TO_MOVIE: Readonly<Record<number, number>> = { 10759: 28, 10765: 878, 10768: 10752 };
const TV_ONLY_GENRES: ReadonlySet<number> = new Set([10762, 10763, 10764, 10766, 10767]);
const MOVIE_ONLY_GENRES: ReadonlySet<number> = new Set([27, 10749, 36, 53, 10402, 10770]);

/** Les genres du profil traduits dans la liste du type interrogé, dédoublonnés. */
export function genresFor(mediaType: "movie" | "tv", ids: readonly number[], count: number): number[] {
  const out: number[] = [];
  for (const id of ids) {
    const mapped =
      mediaType === "movie"
        ? TV_TO_MOVIE[id] ?? (TV_ONLY_GENRES.has(id) ? null : id)
        : MOVIE_TO_TV[id] ?? (MOVIE_ONLY_GENRES.has(id) ? null : id);
    if (mapped != null && !out.includes(mapped)) out.push(mapped);
    if (out.length >= count) break;
  }
  return out;
}

/**
 * Candidats `/discover` filtrés sur les facettes dominantes du profil :
 * genres, keywords, personnes (cast + crew), décennies préférées. Deux tris
 * par type (qualité, popularité) pour élargir sans doublonner les requêtes.
 */
export async function candidatesFromDiscover(profile: TasteVector): Promise<Candidate[]> {
  if (!tmdbConfigured()) return [];

  const profileGenres = topIds(profile, "genre:", 8);
  const keywords = topIds(profile, "kw:", 4);
  const people = [...topIds(profile, "director:", 2), ...topIds(profile, "actor:", 2)];
  const decades = topDecades(profile, 2);

  const out: Candidate[] = [];
  for (const mediaType of ["movie", "tv"] as const) {
    const genres = genresFor(mediaType, profileGenres, 3);
    const dateField = mediaType === "movie" ? "primary_release_date" : "first_air_date";
    const queries: Array<Record<string, string>> = [];
    if (genres.length) {
      queries.push({ with_genres: genres.join("|"), sort_by: "vote_average.desc" });
      queries.push({ with_genres: genres.join("|"), sort_by: "popularity.desc" });
    }
    if (keywords.length) queries.push({ with_keywords: keywords.join("|"), sort_by: "vote_average.desc" });
    // `with_people` (cast + crew confondus) n'existe que côté films.
    if (people.length && mediaType === "movie") {
      queries.push({ with_people: people.join("|"), sort_by: "popularity.desc" });
    }
    if (decades.length && genres.length) {
      const from = Math.min(...decades);
      const to = Math.max(...decades) + 9;
      queries.push({
        with_genres: genres.join("|"),
        [`${dateField}.gte`]: `${from}-01-01`,
        [`${dateField}.lte`]: `${to}-12-31`,
        sort_by: "vote_average.desc",
      });
    }

    for (const query of queries) {
      for (const page of ["1", "2"]) {
        try {
          const res = await tmdbFetch<TmdbListPage>(
            `/discover/${mediaType}`,
            cappedReleaseParams(mediaType, { ...query, "vote_count.gte": DISCOVER_MIN_VOTES, page }),
            BACKGROUND
          );
          for (const raw of res.results ?? []) {
            if (!isReleasedResult(raw)) continue;
            out.push(toCandidate(raw, mediaType, "tmdb_discover"));
          }
        } catch {
          // Un discover en échec n'empêche pas les autres.
        }
      }
    }
  }
  return out;
}
