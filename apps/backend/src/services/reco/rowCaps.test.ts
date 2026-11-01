import { describe, expect, it } from "vitest";
import type { PoolEntry, PoolPayload } from "./generationJob";
import { assignMatches } from "./poolMatch";
import { buildRow } from "./rowBuilder";
import { anchorMaxFor, capRowDiversity, pickCapped } from "./rowCaps";

/** Un titre synthétique : ses auteurs, acteurs, saga et l'ancre de sa raison. */
function entryOf(n: number, over: { facets?: string[]; anchor?: string; total?: number } = {}): PoolEntry {
  return {
    candidate: {
      key: `movie:${n}`, mediaType: "movie", tmdbId: n, title: `Titre ${n}`, year: 2020,
      facets: [{ key: `kw:k${n}`, mult: 1 }, { key: "genre:18", mult: 1 }, ...(over.facets ?? []).map((key) => ({ key, mult: 1 }))],
      voteAverage: 7.5, voteCount: 2000, popularity: 10, source: "library", jellyfinItemId: `jf-${n}`, posterPath: "/p.jpg",
    },
    breakdown: {
      total: over.total ?? 1 - n / 1000, similarity: 0.6, relevance: 0.6, quality: 0.8, freshness: 1, popularityPenalty: 0, topContributors: [],
      ...(over.anchor ? { topAnchors: [{ key: over.anchor, title: over.anchor, weight: 1, similarity: 0.5, liked: true }] } : {}),
    },
  } as PoolEntry;
}

const take = (list: PoolEntry[], n: number) => list.slice(0, n);
const keysOf = (list: PoolEntry[]) => list.map((e) => e.candidate.key);

describe("plafonds des rangées personnelles", () => {
  it("deux titres au plus par réalisateur, par acteur, par saga", () => {
    const entries = [
      ...[1, 2, 3, 4].map((n) => entryOf(n, { facets: ["director:9"] })),
      ...[5, 6, 7].map((n) => entryOf(n, { facets: ["actor:8"] })),
      ...[10, 11, 12].map((n) => entryOf(n, { facets: ["collection:7"] })),
      entryOf(20),
    ];
    expect(keysOf(capRowDiversity(entries, 20))).toEqual(["movie:1", "movie:2", "movie:5", "movie:6", "movie:10", "movie:11", "movie:20"]);
  });

  it("une même ancre ne justifie pas plus d'un tiers de la rangée", () => {
    const entries = Array.from({ length: 12 }, (_, i) => entryOf(i + 1, { anchor: i < 9 ? "movie:900" : undefined }));
    const kept = capRowDiversity(entries, 12);
    expect(anchorMaxFor(12)).toBe(4);
    expect(kept.filter((e) => e.breakdown.topAnchors?.[0]?.key === "movie:900")).toHaveLength(4);
  });

  it("profil maigre : la rangée se complète hors plafond d'ancre, jamais hors plafond d'auteur", () => {
    const entries = [
      ...Array.from({ length: 8 }, (_, i) => entryOf(i + 1, { anchor: "movie:900" })),
      ...[30, 31, 32].map((n) => entryOf(n, { anchor: "movie:900", facets: ["director:5"] })),
    ];
    const row = pickCapped(entries, 11, take);
    expect(row).toHaveLength(10);
    expect(keysOf(row)).toContain("movie:31");
    expect(keysOf(row)).not.toContain("movie:32");
  });

  it("« Pour vous » et « Films pour vous » ne servent jamais trois films d'un même réalisateur", () => {
    const entries = [
      ...Array.from({ length: 8 }, (_, i) => entryOf(i + 1, { facets: ["director:42"], total: 2 - i / 100 })),
      ...Array.from({ length: 40 }, (_, i) => entryOf(100 + i)),
    ].sort((a, b) => b.breakdown.total - a.breakdown.total);
    assignMatches(entries);
    const pool: PoolPayload = { generatedAt: "2026-11-01T00:00:00.000Z", strategyId: "t", poolSize: entries.length, seeds: [], entries, labels: {} };
    const opts = { exclude: new Set<string>(), vigieAvailable: true, inLibraryOnly: false, lambda: 0.7, profile: { facets: {}, signalCount: 30 } };
    for (const key of ["forYou", "forYouMovies", "inLibrary"]) {
      const row = buildRow(pool, key, opts)!;
      const byDirector = row.items.filter((i) => Number(i.key.split(":")[1]) <= 8);
      expect(byDirector.length, key).toBeLessThanOrEqual(2);
      expect(row.items.length, key).toBeGreaterThanOrEqual(20);
    }
  });
});
