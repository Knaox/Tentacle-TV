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

  it("la première raison est le titre aimé le plus proche ; une rangée « Parce que… » le remplace par sa graine", () => {
    const withAnchor = (key: string, score: number): PoolEntry => {
      const e = entry(key, score);
      e.candidate.seedKey = "movie:99";
      // Un VRAI parent de la graine (cf. isRealKin) : elle porte son score, il plaît au compte.
      e.breakdown.topAnchors = [
        { key: "tv:5", title: "Ma liste seulement", contribution: 2, liked: false },
        { key: "tv:6", title: "Twin Peaks", contribution: 1, liked: true },
        { key: "movie:99", title: "Alien", contribution: 0.5, liked: true },
      ];
      e.breakdown.relevance = 0.6;
      return e;
    };
    const entries = Array.from({ length: 6 }, (_, i) => withAnchor(`movie:${i + 1}`, 0.9 - i * 0.01));
    const opts = { exclude: new Set<string>(), vigieAvailable: true, inLibraryOnly: false, lambda: 0.7, profile: { facets: {}, signalCount: 0 } };
    const forYou = buildRow(pool(entries), "inLibrary", opts);
    expect(forYou?.items[0].reasons[0]).toEqual({ kind: "seed", seedTitle: "Twin Peaks" });
    const seeded = { ...pool(entries), seeds: [{ mediaType: "movie" as const, tmdbId: 99, title: "Alien", strength: 1 }] };
    const because = buildRow(seeded, "becauseYouLiked:movie:99", opts);
    const seedReasons = because?.items[0].reasons.filter((r) => r.kind === "seed") ?? [];
    expect(seedReasons).toEqual([{ kind: "seed", seedTitle: "Alien" }]);
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

describe("buildRow — Films pour vous", () => {
  it("les meilleurs FILMS seulement ; trop peu de films : pas de rangée", () => {
    const tv = (n: number) => {
      const e = entry(`tv:${n}`, 0.95);
      e.candidate.mediaType = "tv";
      return e;
    };
    const opts = { exclude: new Set<string>(), vigieAvailable: true, inLibraryOnly: false, lambda: 0.7, profile: { facets: {}, signalCount: 0 } };
    const movies = Array.from({ length: 8 }, (_, i) => entry(`movie:${i + 1}`, 0.9 - i * 0.01));
    const row = buildRow(pool([tv(100), tv(101), ...movies]), "forYouMovies", opts);
    expect(row?.items.length).toBe(8);
    expect(row?.items.every((i) => i.key.startsWith("movie:"))).toBe(true);
    expect(buildRow(pool([tv(100), ...movies.slice(0, 3)]), "forYouMovies", opts)).toBeNull();
  });
});
