import { describe, expect, it } from "vitest";
import { IDF_MAX, IDF_MIN, computeIdf, idfValue } from "./idf";

describe("IDF", () => {
  it("une facette banale (40 % du corpus) pèse bien moins qu'une rare (0,3 %)", () => {
    const common = idfValue(1000, 400);
    const rare = idfValue(1000, 3);
    expect(rare).toBeGreaterThan(common * 3);
  });

  it("bornes : jamais sous le plancher ni au-dessus du plafond", () => {
    expect(idfValue(10, 10)).toBeGreaterThanOrEqual(IDF_MIN);
    expect(idfValue(10_000_000, 0)).toBeLessThanOrEqual(IDF_MAX);
  });

  it("computeIdf compte les documents et applique la formule", () => {
    const docs = [
      new Set(["genre:18", "kw:rare"]),
      new Set(["genre:18"]),
      new Set(["genre:18", "kw:autre"]),
      new Set(["genre:18"]),
    ];
    const idf = computeIdf(docs);
    expect(idf.get("genre:18")?.docCount).toBe(4);
    expect(idf.get("kw:rare")?.docCount).toBe(1);
    expect(idf.get("kw:rare")!.idf).toBeGreaterThan(idf.get("genre:18")!.idf);
    expect(idf.get("genre:18")!.idf).toBeCloseTo(idfValue(4, 4), 10);
  });
});
