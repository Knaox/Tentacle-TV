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
});
