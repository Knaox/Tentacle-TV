import { describe, expect, it } from "vitest";
import {
  HALF_LIFE_DAYS,
  buildFacetVector,
  decayFactor,
  ratingSignalWeight,
  ratingStats,
  truncateVector,
  SIGNAL_ABANDON,
  SIGNAL_FAVORITE,
  seriesEngagementWeight,
  universeShare,
  EPISODES_PER_MOVIE,
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

describe("échelle absolue des notes — point neutre 6,5", () => {
  const generous = ratingStats([8, 8, 9, 9, 9, 10, 10, 10, 10, 10, 8, 9]);

  it("un 7 est un « j'aime bien » : jamais négatif, même chez un noteur généreux", () => {
    // Moyenne 9 : l'ancienne normalisation faisait de son 7 (et de son 8) un
    // reproche. Une note veut dire la même chose pour tout le monde.
    expect(ratingSignalWeight(7, generous.stdDev)).toBeGreaterThan(0);
    expect(ratingSignalWeight(8, generous.stdDev)).toBeGreaterThan(0);
    expect(ratingSignalWeight(6, generous.stdDev)).toBeGreaterThanOrEqual(-0.1);
  });

  it("un noteur généreux reste discriminant : son 10 pèse plus du double de son 8", () => {
    const low = ratingSignalWeight(8, generous.stdDev);
    const high = ratingSignalWeight(10, generous.stdDev);
    expect(low).toBeGreaterThan(0);
    expect(high).toBeGreaterThan(2 * low);
  });

  it("un 8 vaut un favori, un 10 deux fois et demi, un 4 deux abandons", () => {
    expect(ratingSignalWeight(8, 0)).toBeCloseTo(0.75, 10);
    expect(ratingSignalWeight(8, 0)).toBeGreaterThan(SIGNAL_FAVORITE);
    expect(ratingSignalWeight(10, 0)).toBeCloseTo(1.75, 10);
    expect(ratingSignalWeight(4, 0)).toBeLessThan(2 * SIGNAL_ABANDON);
  });

  it("la grille de démarrage : cinq titres aimés à 8 pèsent chacun comme un 8 isolé", () => {
    // Moyenne personnelle 8, écart nul : l'ancienne formule donnait cinq poids
    // nuls — aucune graine, un profil vierge au sortir du démarrage à froid.
    const { stdDev } = ratingStats([8, 8, 8, 8, 8]);
    const w = ratingSignalWeight(8, stdDev);
    expect(w).toBeCloseTo(ratingSignalWeight(8, 0), 10);
    expect(w).toBeGreaterThan(SIGNAL_FAVORITE);
  });

  it("les notes médianes (5..7) pèsent peu (× 0,2)", () => {
    expect(Math.abs(ratingSignalWeight(5, 0))).toBeLessThanOrEqual(0.2);
    expect(Math.abs(ratingSignalWeight(6, 2))).toBeLessThanOrEqual(0.2);
    expect(Math.abs(ratingSignalWeight(7, 0))).toBeLessThanOrEqual(0.2);
  });

  it("un noteur qui étale ses notes sur toute l'échelle a des points qui pèsent moins", () => {
    // Écart-type 3,5 (notes de 1 à 10) : un 10 vaut 1 au lieu de 1,75.
    expect(ratingSignalWeight(10, 3.5)).toBeCloseTo(1, 10);
    expect(ratingSignalWeight(10, 3.5)).toBeLessThan(ratingSignalWeight(10, 0));
  });

  it("l'unité d'échelle évite la division par un epsilon", () => {
    expect(ratingSignalWeight(10, 0.05)).toBeCloseTo(1.75, 10);
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

describe("part d'un univers dans les signaux", () => {
  const anime = [{ key: "universe:anime", mult: 1 }, { key: "genre:16", mult: 1 }];
  const live = [{ key: "genre:18", mult: 1 }];

  it("zéro sans signal, moitié quand un signal sur deux porte l'univers", () => {
    expect(universeShare([], "universe:anime")).toBe(0);
    const signals = [
      { weight: 0.5, ageDays: 0, facets: anime },
      { weight: 0.5, ageDays: 0, facets: live },
    ];
    expect(universeShare(signals, "universe:anime")).toBeCloseTo(0.5, 10);
  });

  it("se mesure en temps de visionnage : une série de quarante épisodes vaut dix films", () => {
    const signals = [
      { weight: 1, ageDays: 0, facets: anime, volume: 40 / EPISODES_PER_MOVIE },
      ...Array.from({ length: 5 }, () => ({ weight: 0.5, ageDays: 0, facets: live })),
    ];
    expect(universeShare(signals, "universe:anime")).toBeCloseTo(10 / 15, 10);
  });

  it("la décroissance s'applique, pas le poids de goût", () => {
    const signals = [
      { weight: 0.5, ageDays: HALF_LIFE_DAYS, facets: anime },
      { weight: -0.9, ageDays: 0, facets: live },
    ];
    // Une demi-vie d'animé (0,5) contre un film entier (1) : un tiers.
    expect(universeShare(signals, "universe:anime")).toBeCloseTo(1 / 3, 10);
  });
});
