// La recherche du faux serveur (`/api/search`, contrat `SearchResponse`), en
// petit mais FIDÈLE au moteur du backend (`services/search/searchService.ts`) :
// un terme répond quand il COMMENCE un mot, accents ignorés ; titre, titre
// original, casting, genres, studios. Le meilleur résultat est un titre trouvé
// par son titre, sinon une personne, sinon rien ; les listes ne le répètent
// pas, les totaux le comptent ; un titre trouvé SEULEMENT par son genre ou son
// studio se replie dans sa pastille dès qu'un titre ou une personne répond.
import { queryItems } from "./library.mjs";

const FACETS = new Set(["genre", "studio"]);
const FIELD_RANK = { title: 0, originalTitle: 1, people: 2, genre: 3, studio: 4 };
const FACETS_SHOWN = 6;

const fold = (text) => String(text ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const wordsOf = (text) => fold(text).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
/** Tous les termes commencent un mot du texte. */
const answers = (terms, text) => {
  const words = wordsOf(text);
  return terms.length > 0 && terms.every((term) => words.some((word) => word.startsWith(term)));
};

/** Le champ qui fait trouver un titre, le plus fort d'abord. */
function matchOf(item, terms) {
  if (answers(terms, item.Name)) return { field: "title" };
  if (item.OriginalTitle && item.OriginalTitle !== item.Name && answers(terms, item.OriginalTitle)) return { field: "originalTitle" };
  const person = (item.People ?? []).find((p) => answers(terms, p.Name));
  if (person) return { field: "people", value: person.Name, role: person.Type };
  const genre = (item.Genres ?? []).find((g) => answers(terms, g));
  if (genre) return { field: "genre", value: genre };
  const studio = (item.Studios ?? []).find((s) => answers(terms, s.Name));
  if (studio) return { field: "studio", value: studio.Name };
  return null;
}

/** Les personnes du catalogue : rôles tenus et titres où elles figurent. */
function peopleOf(items) {
  const people = new Map();
  for (const item of items) {
    for (const p of item.People ?? []) {
      const entry = people.get(p.Id) ?? { id: p.Id, name: p.Name, imageTag: p.PrimaryImageTag ?? null, roles: new Map(), itemIds: new Set() };
      entry.roles.set(p.Type, (entry.roles.get(p.Type) ?? 0) + 1);
      entry.itemIds.add(item.Id);
      people.set(p.Id, entry);
    }
  }
  return [...people.values()];
}

/** Les pastilles : chaque nom qui répond, et le nombre de titres qu'il couvre. */
function facetsOf(items, terms, namesOf) {
  const counts = new Map();
  for (const item of items) for (const name of namesOf(item)) counts.set(name, (counts.get(name) ?? 0) + 1);
  return [...counts.entries()]
    .filter(([name]) => answers(terms, name))
    .sort((a, b) => b[1] - a[1])
    .slice(0, FACETS_SHOWN)
    .map(([name, count]) => ({ name, count }));
}

export function search(library, params) {
  const query = params.get("q") ?? "";
  const limit = Number(params.get("limit") ?? 12) || 12;
  const terms = wordsOf(query);
  const catalog = queryItems(library, new URLSearchParams({ Recursive: "true", IncludeItemTypes: "Movie,Series" })).Items;
  let found = catalog
    .map((item, order) => ({ item, match: matchOf(item, terms), order }))
    .filter((hit) => hit.match !== null);
  if (found.some((hit) => !FACETS.has(hit.match.field))) found = found.filter((hit) => !FACETS.has(hit.match.field));
  found.sort((a, b) => FIELD_RANK[a.match.field] - FIELD_RANK[b.match.field] || a.order - b.order);
  const hits = found.map(({ item, match }, index) => ({ item, match, score: Math.round((100 - index) * 10) / 1000 }));

  const people = peopleOf(catalog)
    .filter((person) => answers(terms, person.name))
    .sort((a, b) => b.itemIds.size - a.itemIds.size)
    .map((person, index) => ({
      id: person.id,
      name: person.name,
      imageTag: person.imageTag,
      roles: [...person.roles.entries()].sort((a, b) => b[1] - a[1]).map(([role]) => role),
      count: person.itemIds.size,
      score: Math.round((100 - index) * 10) / 1000,
    }));

  const titled = hits[0]?.match.field === "title" || hits[0]?.match.field === "originalTitle";
  const top = titled ? { kind: "item", hit: hits[0] } : people[0] ? { kind: "person", hit: people[0] } : null;
  const listed = hits.filter((hit) => !(top?.kind === "item" && hit.item.Id === top.hit.item.Id));
  const ofType = (list, type) => list.filter((hit) => hit.item.Type === type);
  return {
    query, ready: true, tookMs: 4, correction: null, partial: false,
    top,
    movies: ofType(listed, "Movie").slice(0, limit),
    series: ofType(listed, "Series").slice(0, limit),
    collections: [],
    people: people.filter((p) => !(top?.kind === "person" && p.id === top.hit.id)).slice(0, limit),
    genres: facetsOf(catalog, terms, (item) => item.Genres ?? []),
    studios: facetsOf(catalog, terms, (item) => (item.Studios ?? []).map((s) => s.Name)),
    totals: { movies: ofType(hits, "Movie").length, series: ofType(hits, "Series").length, collections: 0, people: people.length },
  };
}

/** Les épisodes qui répondent (`SearchEpisodesResponse`), par leur titre. */
export function searchEpisodes(library, params) {
  const query = params.get("q") ?? "";
  const terms = wordsOf(query);
  const episodes = queryItems(library, new URLSearchParams({ Recursive: "true", IncludeItemTypes: "Episode" })).Items
    .filter((episode) => answers(terms, episode.Name));
  return { query, episodes };
}
