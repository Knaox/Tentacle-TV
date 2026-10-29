import { describe, expect, it } from "vitest";
import { buildLibraryRows } from "./libraryRows";

const id = (s: string) => s;

describe("la grille de la bibliothèque en rangées", () => {
  it("sans favori : la grille d'avant, sans aucun titre", () => {
    const rows = buildLibraryRows({ favorites: [], rest: ["a", "b", "c"], columns: 2, keyOf: id });
    expect(rows.map((r) => r.type)).toEqual(["cards", "cards"]);
    expect(rows[0]).toMatchObject({ items: ["a", "b"] });
    expect(rows[1]).toMatchObject({ items: ["c"] });
  });

  it("avec favoris : « Vos favoris », ses cartes, puis le titre du reste et ses cartes — jamais mêlés dans une rangée", () => {
    const rows = buildLibraryRows({ favorites: ["f1", "f2", "f3"], rest: ["a"], columns: 2, keyOf: id });
    expect(rows.map((r) => (r.type === "title" ? `T:${r.section}` : r.items.join("+")))).toEqual(["T:favorites", "f1+f2", "f3", "T:rest", "a"]);
  });

  it("que des favoris : pas de titre du reste", () => {
    const rows = buildLibraryRows({ favorites: ["f1"], rest: [], columns: 3, keyOf: id });
    expect(rows.map((r) => r.type)).toEqual(["title", "cards"]);
  });

  it("des clés stables et uniques (la virtualisation les suit)", () => {
    const rows = buildLibraryRows({ favorites: ["x"], rest: ["x2", "y"], columns: 1, keyOf: id });
    const keys = rows.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
