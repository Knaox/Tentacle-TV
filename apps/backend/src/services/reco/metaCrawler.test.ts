/**
 * Le crawler de plateformes : ordre (seaux en tour de rôle), effacement
 * devant l'interactif, budget quotidien, flush vers les pools, cache d'abord
 * au reseed, changement de région. TMDB, le cache et le magasin de pools sont
 * des faux ; le temps est factice.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PoolEntry, PoolPayload } from "./generationJob";

let interactiveAt = 0;
let fetched: string[] = [];
const cache = new Map<string, number[] | null>();
const pools = new Map<string, PoolPayload>();
const raced = new Set<string>();

vi.mock("../tmdb/client", () => ({
  tmdbConfigured: () => true,
  tmdbLastInteractiveAt: () => interactiveAt,
}));
vi.mock("../tmdb/providerNormalize", () => ({ watchRegion: () => "FR" }));
vi.mock("../tmdb/metaCache", () => ({
  metaKey: (mediaType: string, tmdbId: number) => `${mediaType}:${tmdbId}`,
  getTitleMeta: vi.fn(async (mediaType: string, tmdbId: number) => {
    fetched.push(`${mediaType}:${tmdbId}`);
    return { providers: [{ id: 283 }] };
  }),
  getCachedMetaMany: vi.fn(async (refs: Array<{ mediaType: string; tmdbId: number }>) => {
    const out = new Map<string, { providers: Array<{ id: number }> | null }>();
    for (const r of refs) {
      const key = `${r.mediaType}:${r.tmdbId}`;
      const ids = cache.get(key);
      if (ids !== undefined) out.set(key, { providers: ids ? ids.map((id) => ({ id })) : null });
    }
    return out;
  }),
}));
vi.mock("./poolStore", () => ({
  patchPool: vi.fn(async (userId: string, mutate: (p: PoolPayload) => boolean) => {
    const pool = pools.get(userId);
    if (!pool) return "missing";
    if (raced.has(userId)) return "raced";
    return mutate(pool) ? "patched" : "unchanged";
  }),
}));

import { enqueueFromPool, resetMetaCrawlerForTests, startMetaCrawler } from "./metaCrawler";

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

const pool = (entries: PoolEntry[], providersRegion = "FR"): PoolPayload => ({
  generatedAt: "2026-09-04T00:00:00.000Z",
  strategyId: "test",
  poolSize: entries.length,
  seeds: [],
  labels: {},
  providersRegion,
  entries,
});

const idsOf = (userId: string) => pools.get(userId)?.entries.map((e) => e.providers);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-04T10:00:00Z"));
  interactiveAt = 0;
  fetched = [];
  cache.clear();
  pools.clear();
  raced.clear();
  resetMetaCrawlerForTests({ dailyBudget: 100 });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("crawler de plateformes", () => {
  it("interroge les comptes en tour de rôle, dans l'ordre du pool, puis patche les pools", async () => {
    const patched: string[] = [];
    pools.set("u1", pool([entry(1), entry(2), entry(3)]));
    pools.set("u2", pool([entry(10), entry(11)]));
    startMetaCrawler({ onPoolPatched: (u) => patched.push(u) });
    await enqueueFromPool("u1", pools.get("u1")!);
    await enqueueFromPool("u2", pools.get("u2")!);
    await vi.advanceTimersByTimeAsync(400 * 6);
    expect(fetched).toEqual(["tv:1", "tv:10", "tv:2", "tv:11", "tv:3"]);
    // Pas encore flushé (moins de 50 appris, moins d'une minute d'inactivité).
    expect(patched).toEqual([]);
    await vi.advanceTimersByTimeAsync(70_000);
    expect(patched.sort()).toEqual(["u1", "u2"]);
    expect(idsOf("u1")).toEqual([[283], [283], [283]]);
    expect(idsOf("u2")).toEqual([[283], [283]]);
  });

  it("s'efface deux secondes après un appel interactif", async () => {
    pools.set("u1", pool([entry(1), entry(2)]));
    startMetaCrawler();
    await enqueueFromPool("u1", pools.get("u1")!);
    interactiveAt = Date.now();
    await vi.advanceTimersByTimeAsync(1_500);
    expect(fetched).toEqual([]);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(fetched.length).toBeGreaterThan(0);
  });

  it("respecte le budget quotidien et flushe ce qu'il a appris", async () => {
    resetMetaCrawlerForTests({ dailyBudget: 2 });
    const patched: string[] = [];
    pools.set("u1", pool([entry(1), entry(2), entry(3)]));
    startMetaCrawler({ onPoolPatched: (u) => patched.push(u) });
    await enqueueFromPool("u1", pools.get("u1")!);
    await vi.advanceTimersByTimeAsync(400 * 5);
    expect(fetched).toEqual(["tv:1", "tv:2"]);
    expect(patched).toEqual(["u1"]);
    expect(idsOf("u1")).toEqual([[283], [283], undefined]);
  });

  it("au reseed, le cache d'abord : ce qu'il sait part sans réseau", async () => {
    cache.set("tv:1", [8]);
    cache.set("tv:2", null);
    const patched: string[] = [];
    pools.set("u1", pool([entry(1), entry(2), entry(3)]));
    startMetaCrawler({ onPoolPatched: (u) => patched.push(u) });
    await enqueueFromPool("u1", pools.get("u1")!, { cachePass: true });
    await vi.advanceTimersByTimeAsync(400 * 3 + 70_000);
    expect(fetched).toEqual(["tv:2", "tv:3"]);
    expect(idsOf("u1")).toEqual([[8], [283], [283]]);
    expect(patched).toEqual(["u1"]);
  });

  it("un pool d'une autre région est réappris tout de suite depuis le cache", async () => {
    cache.set("tv:1", [8]);
    const patched: string[] = [];
    pools.set("u1", pool([entry(1, [999]), entry(2, [999])], "CH"));
    startMetaCrawler({ onPoolPatched: (u) => patched.push(u) });
    await enqueueFromPool("u1", pools.get("u1")!);
    expect(patched).toEqual(["u1"]);
    expect(pools.get("u1")?.providersRegion).toBe("FR");
    expect(idsOf("u1")).toEqual([[8], null]);
    await vi.advanceTimersByTimeAsync(400 * 2);
    expect(fetched).toEqual(["tv:2"]);
  });

  it("un pool régénéré entre-temps n'est pas écrasé, et n'est plus attendu", async () => {
    const patched: string[] = [];
    pools.set("u1", pool([entry(1)]));
    raced.add("u1");
    startMetaCrawler({ onPoolPatched: (u) => patched.push(u) });
    await enqueueFromPool("u1", pools.get("u1")!);
    await vi.advanceTimersByTimeAsync(400 * 2 + 70_000);
    expect(fetched).toEqual(["tv:1"]);
    expect(patched).toEqual([]);
    expect(idsOf("u1")).toEqual([undefined]);
  });
});
