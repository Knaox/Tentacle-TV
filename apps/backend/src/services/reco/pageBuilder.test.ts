import { describe, expect, it, vi } from "vitest";
import type { PoolEntry, PoolPayload } from "./generationJob";
import type { SnapshotRow } from "./pageSnapshot";
import type { RecoRowItem } from "./rowItem";
import type { ServeContext } from "./serveContext";

vi.mock("../db", () => ({ getPrisma: () => ({}) }));
vi.mock("../seerConfig", () => ({ getSeerrConfig: () => null }));
vi.mock("../tmdb/providerDirectory", () => ({
  getWatchProviderDirectory: async () => ({ region: "FR", providers: [], logos: {} }),
  providerRefOf: (id: number) => ({ id, name: `P${id}`, logoPath: null }),
}));

import { buildPageSnapshot, filterPoolEntries } from "./pageBuilder";
import type { PageBuildBase } from "./pageBuilder";

const entry = (n: number, providers?: number[] | null): PoolEntry => ({
  candidate: {
    key: `movie:${n}`,
    mediaType: "movie",
    tmdbId: n,
    title: `t${n}`,
    year: 2020 + (n % 5),
    facets: [{ key: `kw:${n}`, mult: 1 }, { key: `genre:${n % 3}`, mult: 1 }],
    voteAverage: 7 + (n % 3),
    voteCount: 1000,
    popularity: 10,
    source: "library",
    jellyfinItemId: `jf-${n}`,
    posterPath: "/p.jpg",
  },
  breakdown: { total: 1 - n / 100, similarity: 0.5, quality: 0.8, freshness: 1, popularityPenalty: 0, topContributors: [] },
  ...(providers === undefined ? {} : { providers }),
});

const item = (n: number, providers: number[] | null): RecoRowItem => ({
  key: `movie:${n}`,
  mediaType: "movie",
  tmdbId: n,
  title: `g${n}`,
  year: null,
  posterPath: "/g.jpg",
  backdropPath: null,
  jellyfinItemId: null,
  source: "trending",
  score: 1,
  voteAverage: null,
  reasons: [],
  providers: providers ? providers.map((id) => ({ id, name: `P${id}`, logoPath: null })) : null,
});

const pool = (entries: PoolEntry[]): PoolPayload => ({
  generatedAt: "2026-09-04T09:00:00.000Z",
  strategyId: "test",
  poolSize: entries.length,
  seeds: [],
  labels: {},
  entries,
});

const ctxOf = (state: ServeContext["state"]): ServeContext => ({
  state,
  signalCount: 20,
  lambda: 0.7,
  includeVigie: true,
  community: true,
  exclude: new Set(),
  profile: { facets: {}, signalCount: 20 },
  bootstrapping: false,
  tmdbConfigured: true,
  personalized: true,
  profileComputedAt: "2026-09-04T08:00:00.000Z",
  settingsUpdatedAt: null,
});

const baseOf = (p: PoolPayload | null, state: ServeContext["state"] = "ready"): PageBuildBase => ({
  userId: "u1",
  ctx: ctxOf(state),
  pool: p,
  poolStamp: p ? { generatedAt: new Date("2026-09-04T09:00:00.000Z"), expiresAt: new Date("2026-09-11T09:00:00.000Z") } : null,
  library: { byKey: new Map(), entries: [] },
  globalRows: new Map<string, SnapshotRow>([
    ["trending", { key: "trending", items: [item(900, [283]), item(901, null), item(902, [8])] }],
    ["serverPulse", { key: "serverPulse", items: [] }],
  ]),
  regional: [],
  providerRefOf: (id) => ({ id, name: `P${id}`, logoPath: null }),
  builtAt: "2026-09-04T10:00:00.000Z",
  dayKey: "2026-09-04",
  globalsGeneratedAt: "2026-09-04T06:00:00.000Z",
});

const ENTRIES = [
  entry(1, [283]), entry(2, [283, 8]), entry(3, [283]), entry(4, [1968]), entry(5, [283]),
  entry(6, [8]), entry(7, [8]), entry(8, null), entry(9), entry(10, []),
];

describe("filterPoolEntries", () => {
  it("garde les entrées disponibles, exclut l'inconnu et le vide", () => {
    expect(filterPoolEntries(ENTRIES, new Set([283, 1968])).map((e) => e.candidate.tmdbId)).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("buildPageSnapshot", () => {
  it("sans filtre : rangées personnalisées et globales, vides omises, providers jamais absents", async () => {
    const snapshot = await buildPageSnapshot(baseOf(pool(ENTRIES)), null);
    const keys = snapshot.rows.map((r) => r.key);
    expect(keys).toContain("forYou");
    expect(keys).toContain("inLibrary");
    expect(keys).toContain("trending");
    expect(keys).not.toContain("serverPulse");
    for (const row of snapshot.rows) {
      expect(row.items.length).toBeGreaterThan(0);
      for (const it of row.items) expect(it.providers).not.toBeUndefined();
    }
    expect(snapshot.filter).toBeNull();
    expect(snapshot.poolGeneratedAt).toBe("2026-09-04T09:00:00.000Z");
    expect(snapshot.state).toBe("ready");
    expect(snapshot.dayKey).toBe("2026-09-04");
  });

  it("avec filtre : construit depuis le sous-ensemble disponible, strict, rangées minces écartées", async () => {
    const snapshot = await buildPageSnapshot(baseOf(pool(ENTRIES)), [283]);
    expect(snapshot.filter).toEqual({ providers: [283] });
    expect(snapshot.rows.map((r) => r.key)).not.toContain("trending"); // 1 item sur 3 → mince
    const forYou = snapshot.rows.find((r) => r.key === "forYou");
    expect(forYou).toBeDefined();
    expect(forYou!.items.length).toBeGreaterThanOrEqual(4);
    for (const row of snapshot.rows) {
      for (const it of row.items) {
        expect(it.providers?.some((p) => p.id === 283 || p.id === 1968)).toBe(true);
      }
    }
  });

  it("état froid : les rangées globales seules, non filtrées", async () => {
    const snapshot = await buildPageSnapshot(baseOf(null, "cold"), null);
    expect(snapshot.rows.map((r) => r.key)).toEqual(["trending"]);
    expect(snapshot.rows[0].items).toHaveLength(3);
    expect(snapshot.poolGeneratedAt).toBeNull();
  });
});
