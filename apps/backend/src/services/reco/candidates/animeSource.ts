import { tmdbConfigured, tmdbFetch } from "../../tmdb/client";
import { ANIME_MIN_SHARE, TMDB_GENRE_ANIMATION, TMDB_KEYWORD_ANIME } from "../facets";
import type { Candidate } from "../scoring/strategy";
import { toCandidate } from "./tmdbSource";
import { cappedReleaseParams, isReleasedResult } from "./released";
import type { TmdbListResult } from "./tmdbSource";

/** Les animés ont moins de votes TMDB que Hollywood : cinquante suffisent
 *  (deux cents ailleurs) — un titre majeur de saison en a rarement plus. */
const ANIME_MIN_VOTES = "50";

/** Les requêtes, jouées par type de média — huit appels TMDB en tout. */
const QUERIES: ReadonlyArray<{ params: Record<string, string>; pages: number }> = [
  {
    params: {
      with_genres: String(TMDB_GENRE_ANIMATION),
      with_original_language: "ja",
      sort_by: "popularity.desc",
    },
    pages: 2,
  },
  {
    params: {
      with_genres: String(TMDB_GENRE_ANIMATION),
      with_original_language: "ja",
      sort_by: "vote_average.desc",
    },
    pages: 1,
  },
  { params: { with_keywords: String(TMDB_KEYWORD_ANIME), sort_by: "popularity.desc" }, pages: 1 },
];

/**
 * Candidats `/discover` de l'univers animé — UNIQUEMENT quand la part d'animé
 * du profil passe le seuil : un profil sans animé ne coûte rien et ne voit
 * rien changer. Le /discover générique ne les atteignait pas (top-3 genres
 * OR-és, deux cents votes, aucune langue) : ici genre Animation + langue
 * japonaise, ou le mot-clé « anime », à cinquante votes.
 */
export async function candidatesFromAnimeDiscover(animeShare: number): Promise<Candidate[]> {
  if (!tmdbConfigured() || animeShare < ANIME_MIN_SHARE) return [];
  const out: Candidate[] = [];
  for (const mediaType of ["movie", "tv"] as const) {
    for (const { params, pages } of QUERIES) {
      for (let page = 1; page <= pages; page++) {
        try {
          const res = await tmdbFetch<{ results?: TmdbListResult[] }>(
            `/discover/${mediaType}`,
            cappedReleaseParams(mediaType, { ...params, "vote_count.gte": ANIME_MIN_VOTES, page: String(page) }),
            { priority: "background" }
          );
          for (const raw of res.results ?? []) {
            if (!isReleasedResult(raw)) continue;
            out.push(toCandidate(raw, mediaType, "tmdb_anime"));
          }
        } catch {
          // Un discover en échec n'empêche pas les autres.
        }
      }
    }
  }
  return out;
}
