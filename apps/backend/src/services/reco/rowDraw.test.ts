import { describe, expect, it } from "vitest";
import type { PoolEntry, PoolPayload } from "./generationJob";
import { assignMatches } from "./poolMatch";
import { buildRow } from "./rowBuilder";
import { dailyShortlist } from "./rowDraw";
import { inDisplayOrder } from "./rowSelection";

function entryOf(n: number, total: number): PoolEntry {
  return {
    candidate: {
      key: `movie:${n}`, mediaType: "movie", tmdbId: n, title: `Titre ${n}`, year: 2020,
      facets: [{ key: `kw:k${n}`, mult: 1 }, { key: `genre:${n % 5}`, mult: 1 }],
      voteAverage: 7.5, voteCount: 2000, popularity: 10, source: "library", jellyfinItemId: `jf-${n}`, posterPath: "/p.jpg",
    },
    breakdown: { total, similarity: 0.6, relevance: 0.6, quality: 0.8, freshness: 1, popularityPenalty: 0, topContributors: [] },
  };
}

const ranked = (n = 200) => Array.from({ length: n }, (_, i) => entryOf(i + 1, 1 - i / n));
const keysOf = (list: readonly { candidate: { key: string } }[]) => list.map((e) => e.candidate.key);
const draw = (dayStamp: string, fatigue?: Map<string, number>) => ({ userId: "compte-a", dayStamp, fatigue });

describe("tirage quotidien des rangées personnelles", () => {
  it("déterministe pour (compte, rangée, jour), différent le lendemain", () => {
    const a = keysOf(dailyShortlist(ranked(), 20, "forYou", draw("2026-11-01")));
    expect(keysOf(dailyShortlist(ranked(), 20, "forYou", draw("2026-11-01")))).toEqual(a);
    expect(keysOf(dailyShortlist(ranked(), 20, "forYou", draw("2026-11-02")))).not.toEqual(a);
    expect(keysOf(dailyShortlist(ranked(), 20, "forYou", { ...draw("2026-11-01"), userId: "compte-b" }))).not.toEqual(a);
  });

  it("une fois et demie la rangée, tirée dans le haut du classement (trois fois la rangée)", () => {
    const picked = dailyShortlist(ranked(), 20, "forYou", draw("2026-11-01"));
    expect(picked).toHaveLength(30);
    expect(picked.every((e) => e.candidate.tmdbId <= 60)).toBe(true);
  });

  it("les plus forts restent majoritaires sur un mois", () => {
    let topHits = 0;
    let tailHits = 0;
    for (let d = 1; d <= 30; d++) {
      const picked = dailyShortlist(ranked(), 20, "forYou", draw(`2026-11-${String(d).padStart(2, "0")}`));
      topHits += picked.filter((e) => e.candidate.tmdbId <= 20).length;
      tailHits += picked.filter((e) => e.candidate.tmdbId > 40).length;
    }
    expect(topHits).toBeGreaterThan(tailHits);
  });

  it("un titre lassé sort de la fenêtre au profit des suivants", () => {
    const fatigue = new Map(Array.from({ length: 20 }, (_, i) => [`movie:${i + 1}`, 0.05] as const));
    const picked = dailyShortlist(ranked(), 20, "forYou", draw("2026-11-01", fatigue));
    expect(picked.filter((e) => e.candidate.tmdbId <= 20)).toHaveLength(0);
  });

  it("la rangée change d'un jour à l'autre, et reste servie dans l'ordre de la correspondance", () => {
    const entries = ranked(120);
    assignMatches(entries);
    const pool: PoolPayload = { generatedAt: "2026-11-01T00:00:00.000Z", strategyId: "t", poolSize: entries.length, seeds: [], entries, labels: {} };
    const opts = { exclude: new Set<string>(), vigieAvailable: true, inLibraryOnly: false, lambda: 0.7, profile: { facets: {}, signalCount: 30 } };
    const day1 = buildRow(pool, "forYouMovies", { ...opts, draw: draw("2026-11-01") })!.items;
    const day2 = buildRow(pool, "forYouMovies", { ...opts, draw: draw("2026-11-02") })!.items;
    expect(new Set(day1.map((i) => i.key))).not.toEqual(new Set(day2.map((i) => i.key)));
    expect(day1.map((i) => i.key)).toEqual(inDisplayOrder(day1).map((i) => i.key));
  });
});
