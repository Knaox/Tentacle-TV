/**
 * Parcourir plutôt que chercher : la FILMOGRAPHIE d'une personne dans la
 * bibliothèque, les titres d'un GENRE ou d'un STUDIO, et les genres à proposer
 * quand la barre est vide. L'app n'a pas de page « personne », « genre » ni
 * « studio » : c'est la page de résultats qui les porte (`/search?person=…`,
 * `/search?genre=…`, `/search?studio=…`).
 *
 * Mêmes règles que la recherche : le catalogue du serveur, filtré par les
 * droits du compte. Une personne qui ne figure dans aucun titre visible n'a
 * pas de filmographie — elle n'existe pas pour ce compte.
 */

import { foldForSearch } from "../../search/searchText";
import type { SearchBrowseResponse, SearchDiscoverResponse } from "../../search/searchTypes";
import { currentEngine } from "./catalog";
import type { CatalogItem } from "./catalogSource";
import { toItemHit, toPersonHit } from "./shaping";
import { getUserAccess, type UserAccess } from "./userAccess";

/** Le plus récent d'abord ; à année égale, le mieux noté. */
function byYearThenRating(a: CatalogItem, b: CatalogItem): number {
  return (b.year ?? 0) - (a.year ?? 0) || (b.rating ?? 0) - (a.rating ?? 0);
}

/** Le mieux noté d'abord ; à note égale, le plus récent. */
function byRatingThenYear(a: CatalogItem, b: CatalogItem): number {
  return (b.rating ?? 0) - (a.rating ?? 0) || (b.year ?? 0) - (a.year ?? 0);
}

function visibleItems(ids: readonly string[], items: ReadonlyMap<string, CatalogItem>, access: UserAccess): CatalogItem[] {
  const seen = new Set<string>();
  const out: CatalogItem[] = [];
  for (const id of ids) {
    const item = items.get(id);
    if (item === undefined || seen.has(id) || !access.items.has(id)) continue;
    seen.add(id);
    out.push(item);
  }
  return out;
}

export async function browsePerson(userId: string, personId: string, limit: number): Promise<SearchBrowseResponse | null> {
  const engine = currentEngine();
  const person = engine?.persons.get(personId);
  const access = engine === null ? null : await getUserAccess(userId);
  if (engine === null || person === undefined || access === null) return null;
  const items = visibleItems(person.itemIds, engine.items, access).sort(byYearThenRating);
  if (items.length === 0) return null;
  return {
    person: toPersonHit(person, items.length, 0),
    genre: null,
    studio: null,
    total: items.length,
    items: items.slice(0, limit).map((item) => {
      const role = item.people.find((p) => p.id === personId)?.role;
      return toItemHit(item, access.items.get(item.id), { field: "people", value: person.name, ...(role ? { role } : {}) }, 0);
    }),
  };
}

/** Un genre ou un studio : ses titres visibles, les mieux notés d'abord. */
export async function browseFacet(userId: string, kind: "genre" | "studio", name: string, limit: number): Promise<SearchBrowseResponse | null> {
  const engine = currentEngine();
  const entry = (kind === "genre" ? engine?.genres : engine?.studios)?.get(foldForSearch(name));
  const access = engine === null ? null : await getUserAccess(userId);
  if (engine === null || entry === undefined || access === null) return null;
  const items = visibleItems(entry.itemIds, engine.items, access).sort(byRatingThenYear);
  if (items.length === 0) return null;
  return {
    person: null,
    genre: kind === "genre" ? entry.name : null,
    studio: kind === "studio" ? entry.name : null,
    total: items.length,
    items: items.slice(0, limit).map((item) =>
      toItemHit(item, access.items.get(item.id), { field: kind, value: entry.name }, 0)),
  };
}

/** Les genres les plus fournis de ce que le compte voit — la barre vide. */
export async function discover(userId: string, limit: number): Promise<SearchDiscoverResponse> {
  const engine = currentEngine();
  const access = engine === null ? null : await getUserAccess(userId);
  if (engine === null || access === null) return { ready: false, genres: [] };
  const genres = [...engine.genres.values()]
    .map((g) => ({ name: g.name, count: g.itemIds.filter((id) => access.items.has(id)).length }))
    .filter((g) => g.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
  return { ready: true, genres };
}
