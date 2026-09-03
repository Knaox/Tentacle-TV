import { describe, expect, it } from "vitest";
import {
  HALF_LIFE_DAYS,
  buildFacetVector,
  decayFactor,
  ratingSignalWeight,
  ratingStats,
  truncateVector,
  SIGNAL_FAVORITE,
  seriesEngagementWeight,
} from "./profileMath";

describe("décroissance temporelle", () => {
  it("un signal du jour pèse plein", () => {
    expect(decayFactor(0)).toBe(1);
  });

  it("une demi-vie exacte pèse moitié", () => {
    expect(decayFactor(HALF_LIFE_DAYS)).toBeCloseTo(0.5, 10);
  });

  it("deux demi-vies pèsent un quart — un signal d'il y a un an pèse nettement moins", () => {
    expect(decayFactor(360)).toBeCloseTo(0.25, 2);
    expect(decayFactor(365)).toBeLessThan(0.5 * decayFactor(30));
  });
});

describe("statistiques de notes", () => {
  it("sous trois notes : moyenne par défaut, écart nul", () => {
    expect(ratingStats([])).toEqual({ mean: 6.5, stdDev: 0 });
    expect(ratingStats([9, 10])).toEqual({ mean: 6.5, stdDev: 0 });
  });

  it("moyenne et écart-type d'un jeu fixe", () => {
    const { mean, stdDev } = ratingStats([4, 6, 8]);
    expect(mean).toBe(6);
    expect(stdDev).toBeCloseTo(1.632993, 5);
  });
});

describe("normalisation des notes sur l'échelle personnelle", () => {
  it("un noteur généreux (tout entre 8 et 10) reste discriminant", () => {
    // Moyenne 9 : son « 8 » est une mauvaise note, son « 10 » une excellente.
    const { mean, stdDev } = ratingStats([8, 8, 9, 9, 9, 10, 10, 10, 10, 10, 8, 9]);
    const low = ratingSignalWeight(8, mean, stdDev);
    const high = ratingSignalWeight(10, mean, stdDev);
    expect(low).toBeLessThan(0);
    expect(high).toBeGreaterThan(0);
    // Les deux bords de SON échelle restent des signaux nets (leur amplitude
    // dépend de la distance à SA moyenne — ici le 8 en est plus loin que le 10).
    expect(Math.abs(low)).toBeGreaterThan(0.5);
    expect(high).toBeGreaterThan(0.5);
  });

  it("les notes médianes (5..7) pèsent peu (±0,2 × écart réduit)", () => {
    const w = ratingSignalWeight(6, 6.5, 2);
    expect(Math.abs(w)).toBeLessThanOrEqual(0.2);
  });

  it("le plancher d'écart-type évite la division par un epsilon", () => {
    // Écart-type quasi nul : sans plancher, 10 vs moyenne 9,9 exploserait.
    const w = ratingSignalWeight(10, 9.9, 0.05);
    expect(w).toBeCloseTo(0.1, 5);
  });
});

describe("accumulation du vecteur de facettes", () => {
  const idfFlat = () => 1;

  it("contribution = poids × mult × décroissance × idf", () => {
    const vector = buildFacetVector(
      [
        { weight: 1, ageDays: 0, facets: [{ key: "genre:18", mult: 1 }, { key: "director:7", mult: 2 }] },
        { weight: -0.6, ageDays: HALF_LIFE_DAYS, facets: [{ key: "genre:18", mult: 1 }] },
      ],
      idfFlat
    );
    expect(vector["director:7"]).toBeCloseTo(2, 10);
    expect(vector["genre:18"]).toBeCloseTo(1 - 0.3, 10);
  });

  it("l'IDF départage : facette rare > facette banale à signal égal", () => {
    const idf = (key: string) => (key === "kw:rare" ? 5 : 0.5);
    const vector = buildFacetVector(
      [{ weight: 1, ageDays: 0, facets: [{ key: "kw:rare", mult: 1 }, { key: "genre:drame", mult: 1 }] }],
      idf
    );
    expect(vector["kw:rare"]).toBeGreaterThan(vector["genre:drame"] * 5);
  });

  it("la troncature garde les facettes les plus marquées, signe compris", () => {
    const t = truncateVector({ a: 5, b: -4, c: 0.1, d: 2 }, 2);
    expect(Object.keys(t).sort()).toEqual(["a", "b"]);
  });
});

describe("engagement d'une série suivie", () => {
  it("rien sous trois épisodes, 0,6 à trois, plein à quarante", () => {
    expect(seriesEngagementWeight(0)).toBe(0);
    expect(seriesEngagementWeight(2)).toBe(0);
    expect(seriesEngagementWeight(3)).toBeCloseTo(0.6, 5);
    expect(seriesEngagementWeight(40)).toBeCloseTo(1, 5);
    expect(seriesEngagementWeight(100)).toBeCloseTo(1, 5);
  });

  it("croît avec les épisodes et dépasse un favori dès six épisodes", () => {
    const w6 = seriesEngagementWeight(6);
    const w12 = seriesEngagementWeight(12);
    const w24 = seriesEngagementWeight(24);
    expect(w6).toBeLessThan(w12);
    expect(w12).toBeLessThan(w24);
    expect(w24).toBeLessThan(seriesEngagementWeight(40));
    expect(w6).toBeGreaterThan(SIGNAL_FAVORITE);
    expect(w12).toBeCloseTo(0.81, 2);
  });
});
