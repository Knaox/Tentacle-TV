import { isAnimeJellyfin } from "../../reco/facets";
import type { LibraryEntry } from "../../reco/candidates/libraryIndex";
import type { WtAffinityKind } from "../protocol";

/**
 * Affinité — à quel type appartient un titre de bibliothèque.
 *
 * Films et séries s'entendent HORS animés : qui choisit « Séries » ne veut pas
 * se voir proposer One Piece, et qui choisit « Animés » veut aussi les films
 * d'animation japonaise. Un animé se reconnaît de trois façons, et une seule
 * suffit :
 *  - côté Jellyfin, le genre « Anime » ou un id AniDB/AniList (la règle du
 *    moteur de recommandations, `isAnimeJellyfin`) ;
 *  - côté moteur, l'univers animé d'une fiche TMDB (`universe:anime`, posé à
 *    l'enrichissement du pool) ;
 *  - la bibliothèque qui le range : une bibliothèque nommée « Animés ». C'est
 *    souvent le seul signe — une bibliothèque d'animés décrite par TMDB n'a
 *    ni genre « Anime » ni id AniDB.
 */

/** « Animés », « Anime », « Animes VF »… mais jamais « Animation », qui couvre
 *  les dessins animés occidentaux, ni « Japanimation » (mot plus long). */
const ANIME_LIBRARY_NAME = /(^|[^\p{L}])anim[eé]s?($|[^\p{L}])/iu;

export function isAnimeLibraryName(name: string): boolean {
  return ANIME_LIBRARY_NAME.test(name);
}

/** Les clés de titres qui sont des animés, d'après les trois signes. */
export function collectAnimeKeys(input: {
  entries: Iterable<LibraryEntry>;
  /** Clés que le pool d'un membre marque `universe:anime`. */
  poolAnimeKeys: Iterable<string>;
  /** Ids Jellyfin des titres rangés dans une bibliothèque d'animés. */
  animeItemIds: ReadonlySet<string>;
}): Set<string> {
  const keys = new Set(input.poolAnimeKeys);
  for (const entry of input.entries) {
    if (isAnimeJellyfin(entry) || input.animeItemIds.has(entry.itemId)) keys.add(entry.key);
  }
  return keys;
}

export function kindOf(entry: Pick<LibraryEntry, "key" | "mediaType">, animeKeys: ReadonlySet<string>): WtAffinityKind {
  if (animeKeys.has(entry.key)) return "anime";
  return entry.mediaType === "movie" ? "movie" : "series";
}

export function countKinds(
  entries: Iterable<Pick<LibraryEntry, "key" | "mediaType">>,
  animeKeys: ReadonlySet<string>,
): Record<WtAffinityKind, number> {
  const counts: Record<WtAffinityKind, number> = { movie: 0, series: 0, anime: 0 };
  for (const entry of entries) counts[kindOf(entry, animeKeys)]++;
  return counts;
}
