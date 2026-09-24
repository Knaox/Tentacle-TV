import { describe, expect, it } from "vitest";
import type { SearchItemHit, SearchPersonHit, SearchResponse } from "./searchTypes";
import { completionFor, franchisePrefix, suggestionsFrom } from "./searchSuggestions";

function hit(id: string, name: string, score: number, type: "Movie" | "Series" | "BoxSet" = "Movie"): SearchItemHit {
  return { item: { Id: id, Name: name, Type: type } as SearchItemHit["item"], match: {} as SearchItemHit["match"], score };
}

function person(id: string, name: string): SearchPersonHit {
  return { id, name, imageTag: null, roles: [], count: 3, score: 1 };
}

function response(over: Partial<SearchResponse>): SearchResponse {
  return {
    query: "", ready: true, tookMs: 1, correction: null, partial: false, top: null,
    movies: [], series: [], collections: [], people: [], genres: [], studios: [],
    totals: { movies: 0, series: 0, collections: 0, people: 0 },
    ...over,
  };
}

const POTTER = [
  hit("hp2", "Harry Potter et la Chambre des secrets", 9),
  hit("hp4", "Harry Potter et la Coupe de feu", 8),
  hit("hp5", "Harry Potter et l'Ordre du Phénix", 7),
  hit("hp7", "Harry Potter et les Reliques de la Mort : 1re partie", 6),
  hit("hp8", "Harry Potter et les Reliques de la Mort : 2e partie", 5),
];

describe("franchisePrefix", () => {
  it("dégage la franchise commune, sans mot de liaison en bout", () => {
    expect(franchisePrefix(POTTER.map((h) => h.item.Name), "harr")).toBe("Harry Potter");
  });

  it("garde la ponctuation du milieu mais pas celle du bout", () => {
    const names = ["Star Wars : Épisode I", "Star Wars : L'Empire contre-attaque"];
    expect(franchisePrefix(names, "star")).toBe("Star Wars");
  });

  it("se tait à moins de deux titres, ou quand elle n'ajoute rien", () => {
    expect(franchisePrefix(["Dune"], "du")).toBeNull();
    expect(franchisePrefix(POTTER.map((h) => h.item.Name), "harry potter et la c")).toBeNull();
    expect(franchisePrefix(["The Batman", "The Boys"], "th")).toBeNull();
  });

  it("ignore les titres qui ne commencent pas par la saisie", () => {
    expect(franchisePrefix(["Harry Potter et la Coupe de feu", "Quand Harry rencontre Sally"], "harr")).toBeNull();
  });
});

describe("suggestionsFrom", () => {
  it("ne répète jamais un titre déjà listé parmi les meilleurs résultats", () => {
    const s = suggestionsFrom("harr", response({ movies: POTTER }), { kind: "movie", people: false });
    expect(s.best.map((h) => h.item.Id)).toEqual(["hp2", "hp4", "hp5", "hp7"]);
    expect(s.queries).toEqual(["Harry Potter"]);
  });

  it("une bibliothèque de films ne propose que des films", () => {
    const data = response({
      top: { kind: "item", hit: hit("s1", "Harrow", 20, "Series") },
      movies: [hit("m1", "Harriet", 3)],
      series: [hit("s1", "Harrow", 20, "Series")],
    });
    expect(suggestionsFrom("harr", data, { kind: "movie" }).best.map((h) => h.item.Id)).toEqual(["m1"]);
    expect(suggestionsFrom("harr", data).best.map((h) => h.item.Id)).toEqual(["s1", "m1"]);
  });

  it("garde le meilleur résultat, que le moteur ne répète pas dans sa catégorie", () => {
    const data = response({
      top: { kind: "item", hit: hit("hp1", "Harry Potter à l'école des sorciers", 30) },
      movies: POTTER.slice(0, 2),
    });
    expect(suggestionsFrom("harr", data, { kind: "movie" }).best.map((h) => h.item.Id)).toEqual(["hp1", "hp2", "hp4"]);
  });

  it("la correction passe en tête — sauf là où elle se dit déjà", () => {
    const data = response({ correction: "dune", movies: [hit("d2", "Dune : Deuxième partie", 4)] });
    expect(suggestionsFrom("dnue", data).queries).toEqual(["dune"]);
    expect(suggestionsFrom("dnue", data, { correction: false }).queries).toEqual([]);
  });

  it("personnes et collections : seulement pour la recherche complète", () => {
    const data = response({
      movies: [hit("m1", "Toy Story", 3)],
      collections: [hit("c1", "Toy Story - La collection", 2, "BoxSet")],
      people: [person("p1", "Tom Hanks"), person("p2", "Tobey Maguire")],
    });
    expect(suggestionsFrom("to", data).queries).toEqual(["Tom Hanks", "Tobey Maguire"]);
    expect(suggestionsFrom("to", data, { people: false }).queries).toEqual([]);
    expect(suggestionsFrom("to", data, { people: false }).people).toEqual([]);
  });
});

describe("completionFor", () => {
  it("complète sur la saisie brute, casse comprise", () => {
    const best = [hit("hp2", "Harry Potter et la Chambre des secrets", 9)];
    expect(completionFor("harry p", { lead: null, best, people: [] })).toBe("otter et la Chambre des secrets");
    expect(completionFor("potter", { lead: null, best, people: [] })).toBeNull();
  });

  it("suit le meilleur résultat du moteur, même une personne absente de la liste", () => {
    const data = response({
      top: { kind: "person", hit: person("p0", "Tom Hanks") },
      people: [person("p1", "Tom Holland"), person("p2", "Tom Cruise")],
    });
    const s = suggestionsFrom("tom", data);
    expect(completionFor("tom", s)).toBe(" Hanks");
    expect(s.queries).toEqual(["Tom Holland", "Tom Cruise"]);
    // Le nom entier tapé : rien à compléter — surtout pas vers un homonyme plus long.
    const exact = response({
      top: { kind: "person", hit: person("p0", "Tom Holland") },
      people: [person("p1", "Tom Hollander")],
    });
    expect(completionFor("tom holland", suggestionsFrom("tom holland", exact))).toBeNull();
    // Une barre locale ne compare que des titres : la personne n'y mène à rien.
    expect(suggestionsFrom("tom", data, { people: false }).lead).toBeNull();
  });
});
