import { describe, expect, it } from "vitest";
import { explorationQuota, noveltyOf, pickExplorationKeys } from "./exploration";
import type { TasteVector } from "./scoring/strategy";

describe("quota d'exploration", () => {
  it("10 % au défaut (70), davantage en aventureux, plancher en sûr", () => {
    expect(explorationQuota(70)).toBeCloseTo(0.1, 10);
    expect(explorationQuota(30)).toBeGreaterThan(0.1);
    expect(explorationQuota(100)).toBe(0.05);
    expect(explorationQuota(0)).toBeLessThanOrEqual(0.25);
  });
});

describe("nouveauté", () => {
  const profile: TasteVector = { signalCount: 10, facets: { "genre:18": 5, "kw:known": 2 } };

  it("facettes inconnues du profil → nouveauté haute", () => {
    expect(noveltyOf(profile, ["genre:99", "kw:jamais-vu"])).toBe(1);
    expect(noveltyOf(profile, ["genre:18", "kw:known"])).toBe(0);
    expect(noveltyOf(profile, ["genre:18", "kw:jamais-vu"])).toBe(0.5);
  });
});

describe("sélection d'exploration", () => {
  it("plancher de qualité respecté, plus nouveaux d'abord, déterministe", () => {
    const items = [
      { key: "a", novelty: 0.9, quality: 0.7 },
      { key: "b", novelty: 0.95, quality: 0.4 }, // sous le plancher : exclu
      { key: "c", novelty: 0.8, quality: 0.6 },
      { key: "d", novelty: 0.9, quality: 0.6 }, // ex æquo avec a : départage par clé
    ];
    expect(pickExplorationKeys(items, 2)).toEqual(["a", "d"]);
    expect(pickExplorationKeys(items, 10)).toEqual(["a", "d", "c"]);
  });

  it("avec la proximité aux goûts : une exploration VOISINE, jamais à l'opposé ni près d'un refus", () => {
    const items = [
      { key: "loin", novelty: 1, quality: 0.8, relevance: 0.05, negative: 0 }, // sans rapport : exclu
      { key: "voisin", novelty: 0.8, quality: 0.75, relevance: 0.6, negative: 0 },
      { key: "connu", novelty: 0.1, quality: 0.8, relevance: 0.9, negative: 0 },
      { key: "refus", novelty: 0.9, quality: 0.8, relevance: 0.7, negative: 0.5 }, // ressemble à un refus
      { key: "faible", novelty: 0.9, quality: 0.5, relevance: 0.8, negative: 0 }, // qualité trop basse
      // Le gros du panier : peu relié aux goûts (fixe la médiane).
      { key: "x1", novelty: 0.9, quality: 0.8, relevance: 0.1, negative: 0 },
      { key: "x2", novelty: 0.9, quality: 0.8, relevance: 0.1, negative: 0 },
      { key: "x3", novelty: 0.9, quality: 0.8, relevance: 0.2, negative: 0 },
    ];
    expect(pickExplorationKeys(items, 2)).toEqual(["voisin", "connu"]);
  });
});
