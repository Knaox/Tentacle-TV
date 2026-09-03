import { describe, expect, it, vi } from "vitest";
import type { PoolEntry } from "./generationJob";

vi.mock("../tmdb/metaCache", () => ({
  metaKey: (mediaType: string, tmdbId: number) => `${mediaType}:${tmdbId}`,
  getCachedMetaMany: vi.fn(async (refs: Array<{ mediaType: string; tmdbId: number }>) => {
    const out = new Map<string, { providers: Array<{ id: number }> | null }>();
    for (const r of refs) {
      if (r.tmdbId === 1) out.set(`${r.mediaType}:1`, { providers: [{ id: 283 }, { id: 1968 }] });
      if (r.tmdbId === 2) out.set(`${r.mediaType}:2`, { providers: null });
      if (r.tmdbId === 3) out.set(`${r.mediaType}:3`, { providers: [] });
    }
    return out;
  }),
}));

import { applyCachedProviders, entriesNeedingProviders, providerIdsOf } from "./poolProviders";

const entry = (tmdbId: number, providers?: number[] | null): PoolEntry => ({
  candidate: {
    key: `tv:${tmdbId}`,
    mediaType: "tv",
    tmdbId,
    title: `t${tmdbId}`,
    year: 2024,
    facets: [],
    voteAverage: 8,
    voteCount: 100,
    popularity: 1,
    source: "tmdb_discover",
  },
  breakdown: { total: 1, similarity: 1, quality: 1, freshness: 1, popularityPenalty: 0, topContributors: [] },
  ...(providers === undefined ? {} : { providers }),
});

describe("providerIdsOf", () => {
  it("null pour l'inconnu, les ids sinon", () => {
    expect(providerIdsOf(null)).toBeNull();
    expect(providerIdsOf({ providers: null } as never)).toBeNull();
    expect(providerIdsOf({ providers: [{ id: 8 }] } as never)).toEqual([8]);
    expect(providerIdsOf({ providers: [] } as never)).toEqual([]);
  });
});

describe("applyCachedProviders", () => {
  it("pose ce que le cache sait, laisse null ce qu'il ignore, ne touche pas au déjà connu", async () => {
    const entries = [entry(1), entry(2), entry(3), entry(4), entry(5, [8])];
    const stats = await applyCachedProviders(entries);
    expect(entries.map((e) => e.providers)).toEqual([[283, 1968], null, [], null, [8]]);
    expect(stats).toEqual({ known: 3, unknown: 2 });
    expect(entriesNeedingProviders(entries)).toEqual([
      { mediaType: "tv", tmdbId: 2 },
      { mediaType: "tv", tmdbId: 4 },
    ]);
  });
});
