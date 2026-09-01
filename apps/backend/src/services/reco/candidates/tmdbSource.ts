import { tmdbConfigured, tmdbFetch } from "../../tmdb/client";
import { decadeOf } from "../facets";
import type { FacetEntry } from "../facets";
import type { Candidate, TasteVector } from "../scoring/strategy";

/** Un titre-graine : un des 20-30 titres les plus forts du profil. */
export interface SeedRef {
  mediaType: "movie" | "tv";
  tmdbId: number;
  title: string;
  strength: number;
}

interface TmdbListResult {
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
  poster_path?: string | null;
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
  return out;
}

function toCandidate(
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
  };
}

/** Nombre de graines qui reçoivent AUSSI un appel /similar (les plus fortes). */
const SIMILAR_SEEDS = 8;

/**
 * Candidats issus des graines : `/recommendations` pour chacune, `/similar`
 * pour les plus fortes. Un échec de graine est silencieux — le pool vit.
 */
export async function candidatesFromSeeds(seeds: SeedRef[]): Promise<Candidate[]> {
  if (!tmdbConfigured()) return [];
  const out: Candidate[] = [];

  for (const [index, seed] of seeds.entries()) {
    const paths = [`/${seed.mediaType}/${seed.tmdbId}/recommendations`];
    if (index < SIMILAR_SEEDS) paths.push(`/${seed.mediaType}/${seed.tmdbId}/similar`);
    for (const path of paths) {
      try {
        const page = await tmdbFetch<TmdbListPage>(path, { page: "1" });
        for (const raw of page.results ?? []) {
          out.push(toCandidate(raw, seed.mediaType, "tmdb_rec"));
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

/**
 * Candidats `/discover` filtrés sur les facettes dominantes du profil :
 * genres, keywords, personnes (cast + crew), décennies préférées. Deux tris
 * par type (qualité, popularité) pour élargir sans doublonner les requêtes.
 */
export async function candidatesFromDiscover(profile: TasteVector): Promise<Candidate[]> {
  if (!tmdbConfigured()) return [];

  const genres = topIds(profile, "genre:", 3);
  const keywords = topIds(profile, "kw:", 4);
  const people = [...topIds(profile, "director:", 2), ...topIds(profile, "actor:", 2)];
  const decades = topDecades(profile, 2);

  const out: Candidate[] = [];
  for (const mediaType of ["movie", "tv"] as const) {
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
          const res = await tmdbFetch<TmdbListPage>(`/discover/${mediaType}`, {
            ...query,
            "vote_count.gte": DISCOVER_MIN_VOTES,
            page,
          });
          for (const raw of res.results ?? []) {
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
