import { describe, expect, it } from "vitest";
import type { SearchItemHit, SearchResponse } from "@tentacle-tv/shared";
import { groupBySection, optionPath, resultOptions, stepIndex, zeroOptions } from "./omniboxModel";

/**
 * L'omnibox au clavier : ce qui se garde, c'est l'ORDRE (celui de l'écran,
 * que les flèches suivent), la dernière option qui mène à tous les résultats,
 * et où chaque option conduit.
 */

function hit(id: string, name: string, type: "Movie" | "Series" | "BoxSet" = "Movie"): SearchItemHit {
  return { item: { Id: id, Name: name, Type: type }, match: { field: "title" }, score: 1 };
}

const RESPONSE: SearchResponse = {
  query: "dune",
  ready: true,
  tookMs: 1,
  correction: null,
  partial: false,
  top: { kind: "item", hit: hit("m1", "Dune") },
  movies: [hit("m2", "Dune : Deuxième partie")],
  series: [hit("s1", "Dune : Prophecy", "Series")],
  collections: [],
  people: [{ id: "p1", name: "Denis Villeneuve", imageTag: null, roles: ["Director"], count: 2, score: 1 }],
  genres: [{ name: "Science-Fiction", count: 12 }],
  studios: [{ name: "Legendary", count: 3 }],
  totals: { movies: 2, series: 1, collections: 0, people: 1 },
};

describe("resultOptions", () => {
  it("suit l'ordre de l'écran, et finit par « tous les résultats »", () => {
    const options = resultOptions(RESPONSE, [{ Id: "e1", Name: "Pilote", Type: "Episode" }], "dune");
    expect(options.map((o) => o.section)).toEqual(["top", "movies", "series", "people", "episodes", "facets", "facets", "all"]);
    expect(new Set(options.map((o) => o.key)).size).toBe(options.length);
  });

  it("sans saisie, pas d'option « tous les résultats »", () => {
    expect(resultOptions(undefined, [], "  ")).toEqual([]);
  });
});

describe("optionPath", () => {
  it("mène chaque option où on l'attend", () => {
    const [top, , , person, genre, studio, all] = resultOptions(RESPONSE, [], "dune");
    expect(optionPath(top!.target)).toBe("/media/m1");
    expect(optionPath(person!.target)).toBe("/search?person=p1&name=Denis%20Villeneuve");
    expect(optionPath(genre!.target)).toBe("/search?genre=Science-Fiction");
    expect(optionPath(studio!.target)).toBe("/search?studio=Legendary");
    expect(optionPath(all!.target)).toBe("/search?q=dune");
  });

  it("une recherche récente se rejoue dans la barre : pas de chemin", () => {
    const [recent] = zeroOptions(["alien"], [], []);
    expect(optionPath(recent!.target)).toBeNull();
  });
});

describe("groupBySection", () => {
  it("regroupe les options consécutives d'une même section", () => {
    const groups = groupBySection(resultOptions(RESPONSE, [], "dune"));
    expect(groups.map((g) => g.section)).toEqual(["top", "movies", "series", "people", "facets", "all"]);
    expect(groups.find((g) => g.section === "facets")?.options).toHaveLength(2);
  });
});

describe("hors bibliothèque", () => {
  const provider = { pluginId: "seer", path: "/search/provider", types: null, label: "Pas encore là", source: "Vigie" };
  const item = {
    id: "movie:603", kind: "movie" as const, title: "Matrix", year: 1999, subtitle: "Film · 1999",
    imageUrl: null, href: "/discover?media=movie:603", badge: null,
  };

  it("vient après ce qui se lit ici, avant les pastilles, un groupe par plugin", () => {
    const options = resultOptions(RESPONSE, [], "dune", [
      { provider, query: "dune", correction: null, complete: true, items: [item], moreHref: null },
      { provider: { ...provider, pluginId: "autre" }, query: "dune", correction: null, complete: true, items: [item], moreHref: null },
    ]);
    const groups = groupBySection(options);
    expect(groups.map((g) => g.key)).toEqual(["top", "movies", "series", "people", "external:seer", "external:autre", "facets", "all"]);
  });

  it("mène à la page du plugin", () => {
    const [option] = resultOptions(undefined, [], "matrix", [
      { provider, query: "matrix", correction: null, complete: true, items: [item], moreHref: null },
    ]).filter((o) => o.section === "external");
    expect(optionPath(option.target)).toBe("/discover?media=movie:603");
  });
});

describe("stepIndex", () => {
  it("boucle aux deux bouts", () => {
    expect(stepIndex(-1, 1, 3)).toBe(0);
    expect(stepIndex(-1, -1, 3)).toBe(2);
    expect(stepIndex(2, 1, 3)).toBe(0);
    expect(stepIndex(0, -1, 3)).toBe(2);
    expect(stepIndex(0, 1, 0)).toBe(-1);
  });
});
