import { titleLanguageParams } from "../titleLanguage";
import { tmdbConfigured, tmdbFetch } from "../../tmdb/client";
import { DEFAULT_FACET_WEIGHTS } from "../facetWeights";
import type { Candidate } from "../scoring/strategy";
import { isReleasedResult } from "./released";
import { toCandidate } from "./tmdbSource";
import type { TmdbListResult } from "./tmdbSource";

/** Œuvres retenues par auteur (les plus populaires). */
const CREDITS_MAX = 12;
/** Sous ce nombre de votes, une œuvre d'auteur est trop confidentielle pour être proposée. */
const MIN_VOTES = 50;
/** Les métiers d'AUTEUR. Un épisode réalisé ne fait pas une œuvre : pour une série, créateur ou showrunner seulement. */
const MOVIE_JOBS = new Set(["Director"]);
const TV_JOBS = new Set(["Creator", "Showrunner"]);

export interface CrewCredit extends TmdbListResult {
  media_type?: string;
  job?: string;
}

/** Pur : les œuvres d'auteur d'une filmographie (sorties, assez votées, sans doublon), les plus populaires d'abord. */
export function authorCredits(crew: readonly CrewCredit[], now: Date = new Date()): CrewCredit[] {
  const seen = new Set<string>();
  return crew
    .filter((c) => {
      const jobs = c.media_type === "movie" ? MOVIE_JOBS : c.media_type === "tv" ? TV_JOBS : null;
      if (!jobs || !c.job || !jobs.has(c.job)) return false;
      if ((c.vote_count ?? 0) < MIN_VOTES || !isReleasedResult(c, now)) return false;
      const key = `${c.media_type}:${c.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
    .slice(0, CREDITS_MAX);
}

/**
 * Les autres œuvres des AUTEURS de ce qu'il adore (créateurs de séries,
 * réalisateurs) : Fargo mène à Legion par Noah Hawley, ce que
 * TMDB ne recommande pas. L'auteur est posé en facette dès la liste : le
 * candidat ressemble à son œuvre adorée avant même son enrichissement.
 */
export async function candidatesFromCreators(authors: ReadonlyArray<{ personId: number; name: string }>): Promise<Candidate[]> {
  if (!tmdbConfigured() || authors.length === 0) return [];
  const out: Candidate[] = [];
  for (const author of authors) {
    try {
      const credits = await tmdbFetch<{ crew?: CrewCredit[] }>(`/person/${author.personId}/combined_credits`, titleLanguageParams(), { priority: "background" });
      for (const raw of authorCredits(credits.crew ?? [])) {
        const mediaType = raw.media_type === "tv" ? "tv" : "movie";
        const candidate = toCandidate(raw, mediaType, "tmdb_person");
        const mult = mediaType === "movie" ? DEFAULT_FACET_WEIGHTS.director : DEFAULT_FACET_WEIGHTS.creator;
        candidate.facets.push({ key: `director:${author.personId}`, mult });
        out.push(candidate);
      }
    } catch {
      // Un auteur muet (réseau, fiche retirée) n'empêche pas les autres.
    }
  }
  return out;
}
