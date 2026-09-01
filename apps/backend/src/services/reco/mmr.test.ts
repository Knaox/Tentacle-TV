import { describe, expect, it } from "vitest";
import { jaccard, selectWithMmr } from "./mmr";
import type { MmrItem } from "./mmr";

const item = (key: string, score: number, facets: string[]): MmrItem => ({
  key,
  score,
  facetKeys: new Set(facets),
});

describe("jaccard", () => {
  it("identique = 1, disjoint = 0, moitié commune = 1/3", () => {
    expect(jaccard(new Set(["a", "b"]), new Set(["a", "b"]))).toBe(1);
    expect(jaccard(new Set(["a"]), new Set(["b"]))).toBe(0);
    expect(jaccard(new Set(["a", "b"]), new Set(["b", "c"]))).toBeCloseTo(1 / 3, 10);
  });
});

describe("MMR", () => {
  const sameGenre = ["genre:18", "kw:war", "decade:2010"];
  const pool = [
    item("a", 0.9, sameGenre),
    item("b", 0.88, sameGenre),
    item("c", 0.86, sameGenre),
    item("d", 0.7, ["genre:35", "kw:heist", "decade:1990"]),
  ];

  it("λ=1 : top-N brut, aucune diversité", () => {
    expect(selectWithMmr(pool, 3, 1)).toEqual(["a", "b", "c"]);
  });

  it("λ=0,7 : le candidat différent entre avant le troisième clone", () => {
    const picked = selectWithMmr(pool, 3, 0.7);
    expect(picked[0]).toBe("a");
    expect(picked).toContain("d");
    expect(picked.indexOf("d")).toBeLessThan(picked.indexOf("c") === -1 ? 3 : picked.indexOf("c"));
  });

  it("déterministe à entrée égale", () => {
    expect(selectWithMmr(pool, 4, 0.7)).toEqual(selectWithMmr(pool, 4, 0.7));
  });

  it("borné par la taille du pool", () => {
    expect(selectWithMmr(pool, 10, 0.7)).toHaveLength(4);
  });
});
