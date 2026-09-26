import { describe, expect, it } from "vitest";
import type { SearchResponse } from "@tentacle-tv/shared";
import { readSearchRoute, searchDepth, searchRouteHref } from "./searchRoute";
import { availableFilters } from "./SearchFilters";
import { effectiveCorrection, isLibraryEmpty } from "./SearchResults";
import { gridCell } from "./SearchSection";

const read = (search: string) => readSearchRoute(new URLSearchParams(search));

describe("l'adresse de la recherche du miroir", () => {
  it("lit la requête seule", () => {
    expect(read("q=dune")).toEqual({ query: "dune", browse: null });
    expect(read("")).toEqual({ query: "", browse: null });
  });

  it("ouvre une filmographie avec son nom et son portrait", () => {
    const { browse } = read("q=dune&person=p1&name=Zendaya&tag=abc");
    expect(browse).toMatchObject({ kind: "person", id: "p1", person: { name: "Zendaya", imageTag: "abc" } });
  });

  it("ignore un paramètre vide et lit genre puis studio", () => {
    expect(read("person=&genre=Com%C3%A9die").browse).toEqual({ kind: "genre", name: "Comédie" });
    expect(read("studio=Pixar").browse).toEqual({ kind: "studio", name: "Pixar" });
  });

  it("fait l'aller-retour adresse → état → adresse", () => {
    const href = searchRouteHref(" dune ", {
      kind: "person", id: "p1", person: { id: "p1", name: "Zendaya", imageTag: null, roles: [], count: 0, score: 0 },
    });
    expect(href).toBe("/search?q=dune&person=p1&name=Zendaya");
    expect(read(href.split("?")[1]).browse).toMatchObject({ kind: "person", id: "p1" });
    expect(searchRouteHref("")).toBe("/search");
    expect(searchRouteHref("", { kind: "genre", name: "Drame" })).toBe("/search?genre=Drame");
  });

  it("ne lit une profondeur que si elle est un entier positif", () => {
    expect(searchDepth(null)).toBe(0);
    expect(searchDepth({ searchDepth: 2 })).toBe(2);
    expect(searchDepth({ searchDepth: -1 })).toBe(0);
    expect(searchDepth({ searchDepth: "3" })).toBe(0);
  });
});

function response(partial: Partial<SearchResponse>): SearchResponse {
  return {
    query: "q", ready: true, tookMs: 1, correction: null, partial: false, top: null,
    movies: [], series: [], collections: [], people: [], genres: [], studios: [],
    totals: { movies: 0, series: 0, collections: 0, people: 0 },
    ...partial,
  } as SearchResponse;
}

describe("les filtres et les résultats", () => {
  it("ne propose que les filtres qui ont quelque chose, « Tout » d'abord", () => {
    expect(availableFilters(undefined, 3)).toEqual([{ key: "all", count: null }]);
    const r = response({ totals: { movies: 4, series: 0, collections: 0, people: 2 } } as Partial<SearchResponse>);
    expect(availableFilters(r, 1).map((f) => f.key)).toEqual(["all", "movies", "people", "episodes"]);
  });

  it("tait une correction qui ne change rien une fois pliée", () => {
    expect(effectiveCorrection(response({ correction: "Amélie" }), "amelie")).toBeNull();
    expect(effectiveCorrection(response({ correction: "Amélie" }), "amelei")).toBe("Amélie");
  });

  it("dit la bibliothèque vide seulement sans aucun épisode", () => {
    expect(isLibraryEmpty(undefined, 0)).toBe(false);
    expect(isLibraryEmpty(response({}), 0)).toBe(true);
    expect(isLibraryEmpty(response({}), 1)).toBe(false);
  });

  it("arrondit une cellule de grille au-dessous", () => {
    expect(gridCell(111.3333)).toBeLessThanOrEqual(111.3333);
    expect(gridCell(120)).toBe(120);
  });
});
