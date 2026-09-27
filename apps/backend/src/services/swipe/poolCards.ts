import type { PoolEntry } from "../reco/generationJob";
import type { LibraryEntry, LibraryIndex } from "../reco/candidates/libraryIndex";
import { genreNamesFromFacets } from "./tmdbGenres";
import type { SwipeLang } from "./tmdbGenres";
import type { DeckSource, SwipeCard } from "./swipeTypes";

/** Le haut du pool classé : la part « goût » de la pile. Au-delà, le pool
 *  sert l'exploration (des titres plausibles que le classement n'a pas mis
 *  en avant). */
export const TASTE_TOP = 150;

/** Carte d'un titre de bibliothèque (affiche servie par Jellyfin). */
export function libraryCard(entry: LibraryEntry, source: DeckSource): SwipeCard {
  return {
    key: entry.key,
    mediaType: entry.mediaType,
    tmdbId: entry.tmdbId,
    title: entry.name,
    year: entry.ProductionYear ?? null,
    genres: (entry.Genres ?? []).slice(0, 3),
    voteAverage: entry.communityRating,
    posterPath: null,
    backdropPath: null,
    jellyfinItemId: entry.itemId,
    source,
    reason: null,
  };
}

/** Carte d'une entrée du pool ; les genres d'un titre de bibliothèque sont
 *  ceux de Jellyfin, ceux d'un titre TMDB se traduisent depuis leurs ids. */
export function poolCard(entry: PoolEntry, source: DeckSource, lang: SwipeLang, library: LibraryIndex): SwipeCard {
  const c = entry.candidate;
  const lib = library.byKey.get(c.key);
  if (lib && !c.posterPath) return { ...libraryCard(lib, source), reason: reasonOf(entry) };
  const tmdbGenres = genreNamesFromFacets(c.facets.map((f) => f.key), lang);
  return {
    key: c.key,
    mediaType: c.mediaType,
    tmdbId: c.tmdbId,
    title: c.title,
    year: c.year,
    genres: tmdbGenres.length > 0 ? tmdbGenres : (lib?.Genres ?? []).slice(0, 3),
    voteAverage: c.voteAverage,
    posterPath: c.posterPath ?? null,
    backdropPath: c.backdropPath ?? null,
    jellyfinItemId: c.jellyfinItemId ?? lib?.itemId ?? null,
    source,
    reason: reasonOf(entry),
  };
}

function reasonOf(entry: PoolEntry): string | null {
  const anchor = entry.breakdown.topAnchors?.find((a) => a.liked !== false && a.title);
  return anchor?.title ?? null;
}

/** Sans affiche, une carte ne se juge pas : on l'écarte. */
export function hasArtwork(card: SwipeCard, library: LibraryIndex): boolean {
  if (card.posterPath) return true;
  const lib = library.byKey.get(card.key);
  return !!lib?.hasPrimaryImage;
}

/**
 * Coupe le pool (déjà classé) en deux : le haut pour le goût, le reste pour
 * l'exploration. Le pool est trié par score décroissant à la génération.
 */
export function splitPool(
  entries: readonly PoolEntry[],
  lang: SwipeLang,
  library: LibraryIndex
): { taste: SwipeCard[]; deep: SwipeCard[] } {
  const sorted = entries.slice().sort((a, b) => b.breakdown.total - a.breakdown.total);
  const cards = sorted.map((e, i) => poolCard(e, i < TASTE_TOP ? "taste" : "explore", lang, library));
  const withArt = cards.filter((c) => hasArtwork(c, library));
  return {
    taste: withArt.filter((c) => c.source === "taste"),
    deep: withArt.filter((c) => c.source === "explore"),
  };
}
