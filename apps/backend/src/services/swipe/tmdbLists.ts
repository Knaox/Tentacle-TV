import { tmdbConfigured, tmdbFetch } from "../tmdb/client";
import { isReleasedResult } from "../reco/candidates/released";
import type { LibraryIndex } from "../reco/candidates/libraryIndex";
import { tmdbGenreName } from "./tmdbGenres";
import type { SwipeLang } from "./tmdbGenres";
import type { DeckSource, SwipeCard } from "./swipeTypes";

/**
 * Les listes TMDB de la pile (tendances, classiques) — appelées par le
 * BACKEND, avec la clé du serveur : rien ne part vers le client que des
 * chemins d'affiches publics. Mises en mémoire par langue : une liste de
 * tendances ne bouge pas en une heure, et la pile se recharge souvent.
 */
interface TmdbListItem {
  id: number;
  title?: string;
  name?: string;
  genre_ids?: number[];
  vote_average?: number;
  vote_count?: number;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
}

const CACHE_MS = 6 * 3600_000;
/** Moins de votes : une curiosité que personne ne saura juger. */
const MIN_VOTES = 50;
/** Pages de « mieux notés » où l'exploration va piocher, au hasard. */
export const TOP_RATED_PAGES = 10;

const cache = new Map<string, { at: number; items: TmdbListItem[] }>();

async function cachedList(path: string, lang: SwipeLang, page: number): Promise<TmdbListItem[]> {
  const key = `${path}|${lang}|${page}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.items;
  try {
    const data = await tmdbFetch<{ results?: TmdbListItem[] }>(path, {
      language: lang === "fr" ? "fr-FR" : "en-US",
      page: String(page),
    });
    const items = data.results ?? [];
    cache.set(key, { at: Date.now(), items });
    return items;
  } catch {
    // TMDB muet : la pile se contente des autres sources.
    return hit?.items ?? [];
  }
}

export function toCard(
  raw: TmdbListItem,
  mediaType: "movie" | "tv",
  source: DeckSource,
  lang: SwipeLang,
  library: LibraryIndex
): SwipeCard {
  const date = raw.release_date || raw.first_air_date || "";
  const key = `${mediaType}:${raw.id}`;
  return {
    key,
    mediaType,
    tmdbId: raw.id,
    title: raw.title ?? raw.name ?? "",
    year: /^\d{4}/.test(date) ? Number(date.slice(0, 4)) : null,
    genres: (raw.genre_ids ?? [])
      .map((g) => tmdbGenreName(g, lang))
      .filter((n): n is string => !!n)
      .slice(0, 3),
    voteAverage: raw.vote_average ?? null,
    posterPath: raw.poster_path ?? null,
    backdropPath: raw.backdrop_path ?? null,
    jellyfinItemId: library.byKey.get(key)?.itemId ?? null,
    source,
    reason: null,
  };
}

function usable(raw: TmdbListItem): boolean {
  return !!raw.poster_path && (raw.vote_count ?? 0) >= MIN_VOTES && isReleasedResult(raw);
}

async function listCards(
  paths: Array<{ path: string; mediaType: "movie" | "tv"; page: number }>,
  source: DeckSource,
  lang: SwipeLang,
  library: LibraryIndex
): Promise<SwipeCard[]> {
  if (!tmdbConfigured()) return [];
  const lists = await Promise.all(
    paths.map(async (p) => (await cachedList(p.path, lang, p.page)).filter(usable).map((r) => toCard(r, p.mediaType, source, lang, library)))
  );
  // Entrelacé film / série : la pile ne fait pas vingt films d'affilée.
  const out: SwipeCard[] = [];
  const longest = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < longest; i++) for (const l of lists) if (l[i]) out.push(l[i]);
  return out;
}

/** Tendances de la semaine (films et séries, deux pages chacun). */
export function trendingCards(lang: SwipeLang, library: LibraryIndex): Promise<SwipeCard[]> {
  return listCards(
    [
      { path: "/trending/movie/week", mediaType: "movie", page: 1 },
      { path: "/trending/tv/week", mediaType: "tv", page: 1 },
      { path: "/trending/movie/week", mediaType: "movie", page: 2 },
      { path: "/trending/tv/week", mediaType: "tv", page: 2 },
    ],
    "popular",
    lang,
    library
  );
}

/** Classiques reconnus, à une page tirée au hasard : l'exploration. */
export function topRatedCards(lang: SwipeLang, library: LibraryIndex, random = Math.random): Promise<SwipeCard[]> {
  const page = () => 1 + Math.floor(random() * TOP_RATED_PAGES);
  return listCards(
    [
      { path: "/movie/top_rated", mediaType: "movie", page: page() },
      { path: "/tv/top_rated", mediaType: "tv", page: page() },
    ],
    "explore",
    lang,
    library
  );
}

/** Vide le cache mémoire : isolation des tests. */
export function resetSwipeListsForTests(): void {
  cache.clear();
}
