import { tmdbConfigured, tmdbFetch } from "../../tmdb/client";
import type { TmdbFetchOptions } from "../../tmdb/client";

/** La génération est du FOND : les fiches et recherches interactives passent devant. */
const BACKGROUND: TmdbFetchOptions = { priority: "background" };
import type { Candidate } from "../scoring/strategy";
import { toCandidate } from "./tmdbSource";
import type { TmdbListResult } from "./tmdbSource";

/** Personnes interrogées au plus par génération — deux appels TMDB chacune. */
const PEOPLE_MAX = 6;
/** Crédits retenus par personne (les plus populaires) — au-delà, du bruit. */
const CREDITS_MAX = 20;
/** Même plancher de votes que /discover : sous 200, un titre est du bruit. */
const DISCOVER_MIN_VOTES = "200";

interface CombinedCredits {
  cast?: Array<TmdbListResult & { media_type?: string }>;
}

/**
 * Candidats des personnes AIMÉES explicitement : `/discover` filtré
 * `with_people` (films seulement — limite TMDB) + `/person/{id}/combined_credits`
 * pour couvrir les SÉRIES. Chaque candidat est signé `personKey` — les rangées
 * « Avec {acteur} » se découpent là-dessus, comme les « Parce que… » sur
 * seedKey. Une personne muette est silencieuse, le pool vit.
 */
export async function candidatesFromPeople(
  people: Array<{ personId: number; name: string }>
): Promise<Candidate[]> {
  if (!tmdbConfigured() || people.length === 0) return [];
  const out: Candidate[] = [];

  for (const person of people.slice(0, PEOPLE_MAX)) {
    try {
      const page = await tmdbFetch<{ results?: TmdbListResult[] }>(
        "/discover/movie",
        {
          with_people: String(person.personId),
          sort_by: "popularity.desc",
          "vote_count.gte": DISCOVER_MIN_VOTES,
          page: "1",
        },
        BACKGROUND
      );
      for (const raw of page.results ?? []) {
        const candidate = toCandidate(raw, "movie", "tmdb_person");
        candidate.personKey = person.personId;
        out.push(candidate);
      }
    } catch {
      // Personne muette (retirée, réseau) : on continue.
    }

    try {
      const credits = await tmdbFetch<CombinedCredits>(
        `/person/${person.personId}/combined_credits`,
        {},
        BACKGROUND
      );
      const cast = (credits.cast ?? [])
        .filter((r) => r.media_type === "movie" || r.media_type === "tv")
        .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
        .slice(0, CREDITS_MAX);
      for (const raw of cast) {
        const candidate = toCandidate(raw, raw.media_type === "tv" ? "tv" : "movie", "tmdb_person");
        candidate.personKey = person.personId;
        out.push(candidate);
      }
    } catch {
      // Idem : les crédits manquants n'empêchent pas le /discover.
    }
  }
  return out;
}
