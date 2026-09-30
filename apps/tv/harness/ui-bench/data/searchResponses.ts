import {
  foldForSearch,
  type MediaItem,
  type SearchFacetHit,
  type SearchItemHit,
  type SearchMatch,
  type SearchMediaItem,
  type SearchPersonHit,
  type SearchResponse,
  type SearchTopHit,
} from "@tentacle-tv/shared";
import type { BenchData } from "./benchData";

/**
 * Des réponses de `/api/search`, CONSTRUITES en filtrant les vrais titres de
 * l'instantané — l'instantané n'a qu'une vraie réponse (« Orgueil »), qui ne
 * montre qu'un meilleur résultat. Mêmes règles que le moteur, en petit :
 * - un titre répond par son titre (ou son titre original), par une personne
 *   de sa distribution, ou — SEULEMENT si rien ne répond autrement — par son
 *   studio ou son genre, qui se replient sinon dans leur pastille ;
 * - le meilleur résultat sort de sa liste, les totaux le comptent ;
 * - `partial` : aucun titre n'a tous les mots, ceux qui en ont un répondent.
 * Aucune image inventée : tout vient des éléments réels.
 */

const LIMIT = 12;

const words = (value?: string | null) => (value ? foldForSearch(value).split(" ").filter(Boolean) : []);

function matches(tokens: string[], value: string | null | undefined, some: boolean): boolean {
  const w = words(value);
  const hit = (token: string) => w.some((word) => word.startsWith(token));
  return tokens.length > 0 && (some ? tokens.some(hit) : tokens.every(hit));
}

/** Un mot ENTIER de la saisie dans le nom : il passe devant un simple préfixe. */
const exactWords = (tokens: string[], value?: string | null) => tokens.filter((token) => words(value).includes(token)).length;

export const asSearchItem = (item: MediaItem) => item as unknown as SearchMediaItem;

/** Les films et séries de l'instantané, une fois chacun. */
export function catalogTitles(data: BenchData): MediaItem[] {
  return Object.values(data.snapshot.items)
    .map((entry) => entry.item)
    .filter((item) => item.Type === "Movie" || item.Type === "Series");
}

function itemHit(item: MediaItem, match: SearchMatch, base: number, tokens: string[]): SearchItemHit {
  const score = base + exactWords(tokens, item.Name) * 20 + (item.CommunityRating ?? 0) * 2 - (item.Name?.length ?? 0) * 0.15;
  return { item: asSearchItem(item), match, score: Math.round(score * 1000) / 1000 };
}

type FacetSource = (item: MediaItem) => string[];

function facetsOf(titles: MediaItem[], tokens: string[], some: boolean, source: FacetSource): SearchFacetHit[] {
  const counts = new Map<string, number>();
  for (const item of titles) for (const name of source(item)) counts.set(name, (counts.get(name) ?? 0) + 1);
  return [...counts.entries()]
    .filter(([name]) => matches(tokens, name, some))
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

const studiosOf: FacetSource = (item) => ((item as { Studios?: Array<{ Name?: string }> }).Studios ?? []).map((s) => s.Name ?? "").filter(Boolean);
const genresOf: FacetSource = (item) => item.Genres ?? [];

export interface ResponseOptions {
  /** Aucun titre n'a tous les mots : on garde ceux qui en ont un. */
  partial?: boolean;
  /** Une collection d'EXEMPLE (l'instantané n'en a aucune) : une copie de ce
   *  titre, marquée « (exemple) », qui regroupe `count` titres. */
  exampleCollection?: { source: MediaItem; name: string; count: number };
}

export function searchResponse(data: BenchData, query: string, options: ResponseOptions = {}): SearchResponse {
  const tokens = words(query);
  const some = options.partial === true;
  const titles = catalogTitles(data);

  const byTitle = titles
    .filter((item) => matches(tokens, item.Name, some) || matches(tokens, item.OriginalTitle, some))
    .map((item) =>
      matches(tokens, item.Name, some)
        ? itemHit(item, { field: "title" }, 100, tokens)
        : itemHit(item, { field: "originalTitle", value: item.OriginalTitle ?? undefined }, 80, tokens),
    );

  const people: SearchPersonHit[] = data
    .list("people")
    .filter((person) => matches(tokens, person.Name, some))
    .map((person) => ({
      id: person.Id,
      name: person.Name ?? "",
      imageTag: person.ImageTags?.Primary ?? null,
      roles: [(person as { PersonType?: string }).PersonType ?? "Actor"],
      count: data.snapshot.credits[person.Id]?.length ?? 0,
      score: 90 + exactWords(tokens, person.Name) * 30,
    }));

  const byPeople = people.flatMap((person) =>
    data.items(data.snapshot.credits[person.id]).map((item) =>
      itemHit(item, { field: "people", value: person.name, role: person.roles[0] }, 60, tokens),
    ),
  );

  const studios = facetsOf(titles, tokens, some, studiosOf);
  const genres = facetsOf(titles, tokens, some, genresOf);
  // Trouvé SEULEMENT par son studio ou son genre : listé quand rien d'autre ne répond.
  const byFacet =
    byTitle.length + byPeople.length > 0
      ? []
      : titles.flatMap((item) => {
          const studio = studiosOf(item).find((name) => studios.some((s) => s.name === name));
          if (studio) return [itemHit(item, { field: "studio", value: studio }, 40, tokens)];
          const genre = genresOf(item).find((name) => genres.some((g) => g.name === name));
          return genre ? [itemHit(item, { field: "genre", value: genre }, 36, tokens)] : [];
        });

  const seen = new Set<string>();
  const hits = [...byTitle, ...byPeople, ...byFacet]
    .sort((a, b) => b.score - a.score)
    .filter((hit) => (seen.has(hit.item.Id) ? false : (seen.add(hit.item.Id), true)));

  const collections: SearchItemHit[] = options.exampleCollection
    ? [{
        item: { ...asSearchItem(options.exampleCollection.source), Name: options.exampleCollection.name, Type: "BoxSet", ChildCount: options.exampleCollection.count },
        match: { field: "title" },
        score: 70,
      }]
    : [];

  const bestItem = hits[0];
  const bestPerson = [...people].sort((a, b) => b.score - a.score)[0];
  const top: SearchTopHit | null =
    bestPerson && (!bestItem || bestPerson.score > bestItem.score)
      ? { kind: "person", hit: bestPerson }
      : bestItem
        ? { kind: "item", hit: bestItem }
        : null;
  const notTop = (hit: SearchItemHit) => !(top?.kind === "item" && top.hit.item.Id === hit.item.Id);
  const movies = hits.filter((hit) => hit.item.Type === "Movie");
  const series = hits.filter((hit) => hit.item.Type === "Series");

  return {
    query,
    ready: true,
    tookMs: 7,
    correction: null,
    partial: some,
    top,
    movies: movies.filter(notTop).slice(0, LIMIT),
    series: series.filter(notTop).slice(0, LIMIT),
    collections,
    people: people.filter((person) => !(top?.kind === "person" && top.hit.id === person.id)).slice(0, LIMIT),
    genres: genres.slice(0, 6),
    studios: studios.slice(0, 6),
    totals: { movies: movies.length, series: series.length, collections: collections.length, people: people.length },
  };
}

/** Les épisodes dont le nom répond (le moteur les cherche par Jellyfin, à part). */
export function searchEpisodes(data: BenchData, query: string, partial = false): SearchMediaItem[] {
  const tokens = words(query);
  return data
    .list("episodes")
    .filter((episode) => matches(tokens, episode.Name, partial))
    .slice(0, LIMIT)
    .map(asSearchItem);
}

/** La vraie réponse de l'instantané (`/api/search?q=Orgueil`), s'il l'a. */
export function capturedResponse(data: BenchData): SearchResponse | null {
  const captured = data.snapshot.extras?.search as { query?: string; response?: SearchResponse } | undefined;
  return captured?.response ?? null;
}
