import { describe, expect, it } from "vitest";
import type { SearchItemHit, SearchMediaItem, SearchPersonHit, SearchResponse } from "@tentacle-tv/shared";
import { tvSearchIsEmpty, tvSearchNotice, tvSearchSections } from "./searchSections";

function hit(id: string, type: "Movie" | "Series" | "BoxSet"): SearchItemHit {
  return { item: { Id: id, Name: id, Type: type }, match: { field: "title" }, score: 1 };
}

function person(id: string): SearchPersonHit {
  return { id, name: id, imageTag: null, roles: ["Actor"], count: 4, score: 1 };
}

function response(over: Partial<SearchResponse>): SearchResponse {
  return {
    query: "q", ready: true, tookMs: 2, correction: null, partial: false, top: null,
    movies: [], series: [], collections: [], people: [], genres: [], studios: [],
    totals: { movies: 0, series: 0, collections: 0, people: 0 },
    ...over,
  };
}

const keys = (data: SearchResponse, episodes: SearchMediaItem[] = []) =>
  tvSearchSections(data, episodes).map((s) => s.key);

describe("tvSearchSections", () => {
  it("ne dessine aucune rangée vide", () => {
    expect(keys(response({ movies: [hit("m", "Movie")] }))).toEqual(["movies"]);
    expect(tvSearchIsEmpty(response({}))).toBe(true);
  });

  it("ouvre sur le meilleur résultat et monte sa catégorie juste dessous", () => {
    const data = response({
      top: { kind: "item", hit: hit("s0", "Series") },
      movies: [hit("m", "Movie")],
      series: [hit("s1", "Series")],
      people: [person("p")],
    });
    expect(keys(data)).toEqual(["top", "series", "movies", "people"]);
  });

  it("une personne en tête fait monter « Personnes »", () => {
    const data = response({
      top: { kind: "person", hit: person("p0") },
      movies: [hit("m", "Movie")],
      people: [person("p1")],
    });
    expect(keys(data)).toEqual(["top", "people", "movies"]);
  });

  it("range les épisodes et les genres/studios après les titres", () => {
    const data = response({
      movies: [hit("m", "Movie")],
      genres: [{ name: "Action", count: 12 }],
      studios: [{ name: "Pixar", count: 5 }],
    });
    const sections = tvSearchSections(data, [{ Id: "e", Name: "e", Type: "Episode" }]);
    expect(sections.map((s) => s.key)).toEqual(["movies", "episodes", "facets"]);
    const facets = sections[2];
    expect(facets.key === "facets" && facets.facets.map((f) => f.kind)).toEqual(["genre", "studio"]);
  });

  it("sans réponse du moteur, les épisodes seuls", () => {
    expect(tvSearchSections(undefined, [{ Id: "e", Name: "e", Type: "Episode" }]).map((s) => s.key)).toEqual(["episodes"]);
    expect(tvSearchSections(undefined)).toEqual([]);
  });
});

describe("tvSearchNotice", () => {
  it("l'index en préparation passe avant tout", () => {
    expect(tvSearchNotice(response({ ready: false, correction: "x" }))).toEqual({ kind: "indexing" });
  });

  it("dit la correction, puis la réponse partielle", () => {
    expect(tvSearchNotice(response({ correction: "harry potter" })))
      .toEqual({ kind: "correction", correction: "harry potter" });
    expect(tvSearchNotice(response({ partial: true }))).toEqual({ kind: "partial" });
    expect(tvSearchNotice(response({}))).toBeNull();
    expect(tvSearchNotice(undefined)).toBeNull();
  });
});
