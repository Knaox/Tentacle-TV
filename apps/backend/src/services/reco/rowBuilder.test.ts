import { describe, expect, it } from "vitest";
import type { PoolEntry, PoolPayload } from "./generationJob";
import { buildRow } from "./rowBuilder";

const entry = (key: string, score: number, providers?: number[] | null): PoolEntry => ({
  candidate: {
    key,
    mediaType: "movie",
    tmdbId: Number(key.split(":")[1]),
    title: key,
    year: 2024,
    facets: [{ key: `kw:${key}`, mult: 1 }],
    voteAverage: 8,
    voteCount: 1000,
    popularity: 10,
    source: "library",
    jellyfinItemId: `jf-${key}`,
    posterPath: "/p.jpg",
  },
  breakdown: { total: score, similarity: score, quality: 0.8, freshness: 1, popularityPenalty: 0, topContributors: [] },
  ...(providers === undefined ? {} : { providers }),
});

const pool = (entries: PoolEntry[]): PoolPayload => ({
  generatedAt: "2026-09-04T00:00:00.000Z",
  strategyId: "test",
  poolSize: entries.length,
  seeds: [],
  entries,
  labels: {},
});

describe("buildRow — plateformes des items", () => {
  it("hydrate les ids du pool par l'annuaire, null reste null", () => {
    const row = buildRow(pool([entry("movie:1", 0.9, [283, 1968]), entry("movie:2", 0.8), entry("movie:3", 0.7, [])]), "inLibrary", {
      exclude: new Set(),
      vigieAvailable: true,
      inLibraryOnly: false,
      lambda: 0.7,
      profile: { facets: {}, signalCount: 0 },
      providerRefOf: (id) => ({ id, name: `P${id}`, logoPath: `/${id}.jpg` }),
    });
    const byKey = new Map(row?.items.map((i) => [i.key, i.providers]));
    expect(byKey.get("movie:1")).toEqual([
      { id: 283, name: "P283", logoPath: "/283.jpg" },
      { id: 1968, name: "P1968", logoPath: "/1968.jpg" },
    ]);
    expect(byKey.get("movie:2")).toBeNull();
    expect(byKey.get("movie:3")).toEqual([]);
  });

  it("sans annuaire : des références nues, jamais undefined", () => {
    const row = buildRow(pool([entry("movie:1", 0.9, [8])]), "inLibrary", {
      exclude: new Set(),
      vigieAvailable: true,
      inLibraryOnly: false,
      lambda: 0.7,
      profile: { facets: {}, signalCount: 0 },
    });
    expect(row?.items[0].providers).toEqual([{ id: 8, name: "", logoPath: null }]);
  });
});
