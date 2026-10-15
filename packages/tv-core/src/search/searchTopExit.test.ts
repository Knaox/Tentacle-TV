import { describe, expect, it } from "vitest";
import {
  createSearchRowMemory,
  searchRowOf,
  searchSectionKey,
  searchTopExit,
  type SearchTopExitInput,
} from "./searchTopExit";

const ROWS = ["top", "movies", "series", "people"];
const mountedAll = () => true;
const nothing = () => null;
const input = (over: Partial<SearchTopExitInput> = {}): SearchTopExitInput => ({
  rowKeys: ROWS,
  focusedKey: "top",
  last: nothing,
  isMounted: mountedAll,
  ...over,
});

describe("BAS depuis le meilleur résultat", () => {
  it("entre dans la rangée suivante par sa PREMIÈRE carte, pas par celle du milieu", () => {
    expect(searchTopExit(input())).toEqual({ section: "section:movies", entry: "movies:0" });
  });

  it("quelle que soit la rangée qui suit : personnes, pastilles, épisodes, « À demander »", () => {
    for (const below of ["people", "facets", "episodes", "absent"]) {
      expect(searchTopExit(input({ rowKeys: ["top", below, "movies"] }))).toEqual({ section: `section:${below}`, entry: `${below}:0` });
    }
  });

  it("une rangée déjà parcourue : la carte où on l'a laissée (elle n'a pas défilé depuis)", () => {
    const last = (row: string) => (row === "movies" ? "movies:6" : null);
    expect(searchTopExit(input({ last }))).toEqual({ section: "section:movies", entry: "movies:6" });
  });

  it("la carte retenue n'est plus montée : la première", () => {
    const last = (row: string) => (row === "movies" ? "movies:6" : null);
    expect(searchTopExit(input({ last, isMounted: (key) => key !== "movies:6" }))).toEqual({ section: "section:movies", entry: "movies:0" });
  });

  it("seulement pendant que la bannière a le focus : ailleurs, aucune entrée (HAUT d'une rangée plus basse reste au plus proche)", () => {
    expect(searchTopExit(input({ focusedKey: "series:3" }))).toBeNull();
    expect(searchTopExit(input({ focusedKey: "movies:0" }))).toBeNull();
    expect(searchTopExit(input({ focusedKey: null }))).toBeNull();
  });

  it("sans bannière en tête, ou bannière seule : rien à déclarer", () => {
    expect(searchTopExit(input({ rowKeys: ["movies", "series"] }))).toBeNull();
    expect(searchTopExit(input({ rowKeys: ["top"] }))).toBeNull();
  });
});

describe("clés", () => {
  it("la section d'une rangée", () => {
    expect(searchSectionKey("movies")).toBe("section:movies");
  });

  it("la rangée d'un élément, parmi les rangées montrées seulement", () => {
    expect(searchRowOf("movies:12", ROWS)).toBe("movies");
    expect(searchRowOf("people:0", ROWS)).toBe("people");
    expect(searchRowOf("top", ROWS)).toBeNull();
    expect(searchRowOf("key:A", ROWS)).toBeNull();
    expect(searchRowOf("episodes:1", ROWS)).toBeNull();
    expect(searchRowOf(null, ROWS)).toBeNull();
  });
});

describe("mémoire des rangées", () => {
  const v1 = {};
  const v2 = {};

  it("retient le dernier élément visité de chaque rangée montrée", () => {
    const memory = createSearchRowMemory();
    memory.sync([{ key: "top", version: v1 }, { key: "movies", version: v1 }]);
    memory.visit("movies:2");
    memory.visit("top");
    memory.visit("movies:4");
    memory.visit("key:A");
    expect(memory.last("movies")).toBe("movies:4");
    expect(memory.last("top")).toBeNull();
  });

  it("ignore une rangée qui n'est pas montrée", () => {
    const memory = createSearchRowMemory();
    memory.sync([{ key: "movies", version: v1 }]);
    memory.visit("series:3");
    expect(memory.last("series")).toBeNull();
  });

  it("oublie une rangée qui change (une autre réponse) ou disparaît ; garde celle qui reste la même", () => {
    const memory = createSearchRowMemory();
    memory.sync([{ key: "movies", version: v1 }, { key: "series", version: v1 }, { key: "people", version: v1 }]);
    memory.visit("movies:5");
    memory.visit("series:2");
    memory.visit("people:1");
    memory.sync([{ key: "movies", version: v2 }, { key: "series", version: v1 }]);
    expect(memory.last("movies")).toBeNull();
    expect(memory.last("series")).toBe("series:2");
    expect(memory.last("people")).toBeNull();
  });
});
