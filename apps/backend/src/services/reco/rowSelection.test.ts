import { describe, expect, it } from "vitest";
import type { PoolEntry } from "./generationJob";
import { interleaveEvenly, isAnimeEntry, mmrPick, pickWithUniverseQuota, universeQuota } from "./rowSelection";

const entry = (key: string, score: number, facets: string[]): PoolEntry => ({
  candidate: {
    key,
    mediaType: "tv",
    tmdbId: Number(key.split(":")[1]),
    title: key,
    year: 2024,
    facets: facets.map((k) => ({ key: k, mult: 1 })),
    voteAverage: 8,
    voteCount: 1000,
    popularity: 10,
    source: "tmdb_discover",
  },
  breakdown: { total: score, similarity: score, quality: 0.8, freshness: 1, popularityPenalty: 0, topContributors: [] },
});

const ANIME = ["universe:anime", "genre:16", "lang:ja"];

describe("quota d'univers", () => {
  it("rien sous le seuil, puis la part du profil entre deux et la moitié", () => {
    expect(universeQuota(27, 0)).toBe(0);
    expect(universeQuota(27, 0.04)).toBe(0);
    expect(universeQuota(27, 0.05)).toBe(2);
    expect(universeQuota(27, 0.1)).toBe(3);
    expect(universeQuota(27, 0.35)).toBe(9);
    expect(universeQuota(27, 0.9)).toBe(13);
    expect(universeQuota(3, 0.5)).toBe(1);
  });
});

describe("entrelacement régulier", () => {
  it("répartit les extras sur la rangée au lieu de les empiler en fin", () => {
    expect(interleaveEvenly(["m1", "m2", "m3", "m4", "m5", "m6"], ["a1", "a2"])).toEqual([
      "m1", "m2", "a1", "m3", "m4", "a2", "m5", "m6",
    ]);
  });

  it("sans extra, une copie ; sans principal, les extras", () => {
    expect(interleaveEvenly(["m1", "m2"], [])).toEqual(["m1", "m2"]);
    expect(interleaveEvenly([], ["a1"])).toEqual(["a1"]);
  });
});

describe("sélection avec quota d'univers", () => {
  // Vingt titres hors univers, bien classés ; cinq animés faibles, tout en bas.
  const others = Array.from({ length: 20 }, (_, i) =>
    entry(`tv:${100 + i}`, 0.9 - i * 0.01, ["genre:18", `kw:${i}`])
  );
  const anime = Array.from({ length: 5 }, (_, i) =>
    entry(`tv:${200 + i}`, 0.5 - i * 0.01, [...ANIME, `kw:a${i}`])
  );
  const entries = [...others, ...anime];

  it("part nulle : identique au MMR seul", () => {
    expect(pickWithUniverseQuota(entries, 10, 0.7, 0)).toEqual(mmrPick(entries, 10, 0.7));
    expect(mmrPick(entries, 10, 0.7).some(isAnimeEntry)).toBe(false);
  });

  it("part d'un tiers : la rangée fait sa taille, l'univers y est représenté et réparti", () => {
    const picked = pickWithUniverseQuota(entries, 10, 0.7, 0.35);
    expect(picked).toHaveLength(10);
    expect(new Set(picked.map((e) => e.candidate.key)).size).toBe(10);
    expect(picked.filter(isAnimeEntry).length).toBeGreaterThanOrEqual(4);
    expect(picked.slice(0, 3).some(isAnimeEntry)).toBe(true);
  });
});
