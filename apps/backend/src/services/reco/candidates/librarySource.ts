import { facetsFromJellyfin } from "../facets";
import type { Candidate } from "../scoring/strategy";
import type { LibraryIndex } from "./libraryIndex";

/** Plafond de candidats bibliothèque (les mieux notés d'abord) : assez haut
 *  pour que TOUT le non-vu d'une bibliothèque familiale soit classé — à 300,
 *  un titre moins bien noté mais taillé pour le compte n'entrait jamais. */
const LIBRARY_POOL_MAX = 3000;

/** Les titres de la bibliothèque non vus — matière première du pool (c'est la
 *  seule source disponible en passe rapide et sans clé TMDB). */
export function libraryCandidates(library: LibraryIndex): Candidate[] {
  return library.entries
    .filter((e) => !e.played)
    .sort((a, b) => (b.communityRating ?? 0) - (a.communityRating ?? 0))
    .slice(0, LIBRARY_POOL_MAX)
    .map((e) => ({
      key: e.key,
      mediaType: e.mediaType,
      tmdbId: e.tmdbId,
      title: e.name,
      year: e.ProductionYear ?? null,
      facets: facetsFromJellyfin(e),
      voteAverage: e.communityRating,
      voteCount: null,
      popularity: null,
      source: "library" as const,
      jellyfinItemId: e.itemId,
    }));
}
