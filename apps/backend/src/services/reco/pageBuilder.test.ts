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

import { PAGE_ROW_MIN_ITEMS, buildPageSnapshot, filterPoolEntries } from "./pageBuilder";
import { dedupeServedRows, isThemedRow } from "./pageRows";
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
  trendingNow: true,
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
  vigieAvailable: false,
  globalRows: new Map<string, SnapshotRow>([
    ["trending", { key: "trending", items: [900, 901, 902, 903, 904, 905, 906, 907].map((n) => item(n, n % 3 === 0 ? [283] : n % 3 === 1 ? null : [8])) }],
    ["serverPulse", { key: "serverPulse", items: [] }],
    ["bestOfLibrary", { key: "bestOfLibrary", items: [950, 951, 952, 953, 954, 955, 956].map((n) => item(n, null)) }],
  ]),
  regional: [],
  providerRefOf: (id) => ({ id, name: `P${id}`, logoPath: null }),
  builtAt: "2026-09-04T10:00:00.000Z",
  dayKey: "2026-09-04",
  globalsGeneratedAt: "2026-09-04T06:00:00.000Z",
});

const PROVIDERS: Array<number[] | null | undefined> = [[283], [283, 8], [283], [1968], [283], [8], [8], null, undefined, []];
// Quarante entrées : « Pour vous » en prend trente, « Disponible… » prend les SUIVANTES.
const ENTRIES = Array.from({ length: 40 }, (_, i) => entry(i + 1, PROVIDERS[i % PROVIDERS.length]));

describe("filterPoolEntries", () => {
  it("garde les entrées disponibles, exclut l'inconnu et le vide", () => {
    expect(filterPoolEntries(ENTRIES.slice(0, 10), new Set([283, 1968])).map((e) => e.candidate.tmdbId)).toEqual([1, 2, 3, 4, 5]);
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
    expect(keys.at(-1)).toBe("bestOfLibrary");
    // « Films pour vous » suit « Pour vous », sans en répéter un titre.
    expect(keys[1]).toBe("forYouMovies");
    const forYou = new Set(snapshot.rows[0].items.map((i) => i.key));
    expect(snapshot.rows[1].items.some((i) => forYou.has(i.key))).toBe(false);
    // Une rangée a six titres au moins, et un titre n'apparaît qu'une fois dans la page servie,
    // sans thèmes (la page du snapshot) comme avec (les rangées suivantes perdent les films).
    for (const served of [snapshot.rows.filter((r) => !isThemedRow(r.key)), dedupeServedRows(snapshot.rows, PAGE_ROW_MIN_ITEMS)]) {
      const seen = new Set<string>();
      for (const row of served) {
        expect(row.items.length).toBeGreaterThanOrEqual(6);
        for (const it of row.items) {
          expect(it.providers).not.toBeUndefined();
          expect(seen.has(it.key)).toBe(false);
          seen.add(it.key);
        }
      }
    }
    expect(snapshot.filter).toBeNull();
    expect(snapshot.poolGeneratedAt).toBe("2026-09-04T09:00:00.000Z");
    expect(snapshot.state).toBe("ready");
    expect(snapshot.dayKey).toBe("2026-09-04");
  });

  it("avec filtre : construit depuis le sous-ensemble disponible, strict, rangées minces écartées", async () => {
    const snapshot = await buildPageSnapshot(baseOf(pool(ENTRIES)), [283]);
    expect(snapshot.filter).toEqual({ providers: [283] });
    expect(snapshot.rows.map((r) => r.key)).not.toContain("trending"); // 3 items sur 8 → mince
    expect(snapshot.rows.map((r) => r.key)).not.toContain("bestOfLibrary"); // disponibilité inconnue
    const forYou = snapshot.rows.find((r) => r.key === "forYou");
    expect(forYou).toBeDefined();
    expect(forYou!.items.length).toBeGreaterThanOrEqual(6);
    for (const row of snapshot.rows) {
      for (const it of row.items) {
        expect(it.providers?.some((p) => p.id === 283 || p.id === 1968)).toBe(true);
      }
    }
  });

  it("état froid : les rangées globales seules, non filtrées", async () => {
    const snapshot = await buildPageSnapshot(baseOf(null, "cold"), null);
    expect(snapshot.rows.map((r) => r.key)).toEqual(["trending", "bestOfLibrary"]);
    expect(snapshot.rows[0].items).toHaveLength(8);
    expect(snapshot.poolGeneratedAt).toBeNull();
  });
});
