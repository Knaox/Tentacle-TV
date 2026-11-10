/**
 * Le moteur de recherche FACTICE du labo (`/api/search*`), sur la bibliothèque de démonstration :
 * titres par leur nom, personnes par le leur, genres et studios en facettes. Assez pour rendre
 * la vraie page de recherche — résultats, meilleur résultat, aucun résultat, parcours d'un
 * genre, d'un studio ou d'une personne.
 */

import type {
  SearchBrowseResponse, SearchDiscoverResponse, SearchEpisodesResponse, SearchFacetHit, SearchItemHit, SearchMediaItem, SearchPersonHit, SearchResponse,
} from "@tentacle-tv/shared";
import type { MediaItem } from "@tentacle-tv/shared";
import { LAB_COLLECTION, LAB_EPISODE_ITEMS, LAB_ITEMS, labPerson } from "./labItems";

const fold = (text: string): string => text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const hit = (item: MediaItem, score = 1): SearchItemHit => ({ item: item as unknown as SearchMediaItem, match: { field: "title" }, score });

function people(): SearchPersonHit[] {
  const byId = new Map<string, SearchPersonHit>();
  for (const item of LAB_ITEMS) {
    for (const person of item.People ?? []) {
      const entry = byId.get(person.Id) ?? { id: person.Id, name: person.Name, imageTag: null, roles: [], count: 0, score: 1 };
      entry.count += 1;
      if (!entry.roles.includes(person.Type)) entry.roles.push(person.Type);
      byId.set(person.Id, entry);
    }
  }
  return [...byId.values()];
}

function facets(pick: (item: MediaItem) => string[]): SearchFacetHit[] {
  const counts = new Map<string, number>();
  for (const item of LAB_ITEMS) for (const name of pick(item)) counts.set(name, (counts.get(name) ?? 0) + 1);
  return [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
}

const genres = (): SearchFacetHit[] => facets((item) => item.Genres ?? []);
const studios = (): SearchFacetHit[] => facets((item) => (item.Studios ?? []).map((s) => s.Name));

export function labSearch(params: URLSearchParams): SearchResponse {
  const query = params.get("q") ?? "";
  const q = fold(query.trim());
  const limit = Number(params.get("limit") ?? 6);
  const titles = LAB_ITEMS.filter((item) => fold(item.Name).includes(q));
  const movies = titles.filter((item) => item.Type === "Movie").map((item) => hit(item));
  const series = titles.filter((item) => item.Type === "Series").map((item) => hit(item));
  const collections = fold(LAB_COLLECTION.Name).includes(q) ? [hit(LAB_COLLECTION)] : [];
  const persons = people().filter((person) => fold(person.name).includes(q));
  const first = movies[0] ?? series[0];
  return {
    query,
    ready: true,
    tookMs: 2,
    correction: null,
    partial: false,
    top: first ? { kind: "item", hit: first } : persons[0] ? { kind: "person", hit: persons[0] } : null,
    movies: movies.slice(0, limit),
    series: series.slice(0, limit),
    collections,
    people: persons.slice(0, limit),
    genres: genres().filter((genre) => fold(genre.name).includes(q)).slice(0, 4),
    studios: studios().filter((studio) => fold(studio.name).includes(q)).slice(0, 4),
    totals: { movies: movies.length, series: series.length, collections: collections.length, people: persons.length },
  };
}

export function labSearchEpisodes(params: URLSearchParams): SearchEpisodesResponse {
  const query = params.get("q") ?? "";
  const q = fold(query.trim());
  return { query, episodes: LAB_EPISODE_ITEMS.filter((episode) => fold(episode.Name).includes(q)) as unknown as SearchMediaItem[] };
}

export function labSearchDiscover(): SearchDiscoverResponse {
  return { ready: true, genres: genres() };
}

/** `/api/search/person/:id` : la filmographie d'une personne dans la bibliothèque. */
export function labPersonCredits(id: string): SearchBrowseResponse {
  const found = labPerson(id);
  const person = people().find((entry) => entry.id === id) ?? null;
  return { person, genre: null, studio: null, items: (found?.credits ?? []).map((item) => hit(item)), total: found?.credits.length ?? 0 };
}

/** `/api/search/genre?name=` et `/api/search/studio?name=`. */
export function labBrowse(kind: "genre" | "studio", name: string): SearchBrowseResponse {
  const items = LAB_ITEMS.filter((item) => (kind === "genre" ? item.Genres?.includes(name) : item.Studios?.some((s) => s.Name === name)));
  return { person: null, genre: kind === "genre" ? name : null, studio: kind === "studio" ? name : null, items: items.map((item) => hit(item)), total: items.length };
}
