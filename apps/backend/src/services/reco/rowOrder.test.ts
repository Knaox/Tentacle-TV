import { describe, expect, it } from "vitest";
import { ANIME_UNIVERSE_KEY } from "./facets";
import type { PoolEntry, PoolPayload } from "./generationJob";
import { gateGlobalRow } from "./pageRows";
import { assignMatches } from "./poolMatch";
import { buildRow } from "./rowBuilder";
import { inDisplayOrder } from "./rowSelection";

/**
 * L'invariant d'ordre des rangées servies : la tête est le titre à la meilleure
 * correspondance, et l'ordre visible suit la correspondance affichée,
 * décroissante — quelle que soit la sélection (MMR, quota d'animés,
 * exploration) qui a choisi les titres.
 */

interface Spec {
  key: string;
  total: number;
  relevance: number;
  mediaType?: "movie" | "tv";
  anime?: boolean;
  genre?: string;
  library?: boolean;
}

const entryOf = (s: Spec): PoolEntry => ({
  candidate: {
    key: s.key,
    mediaType: s.mediaType ?? "movie",
    tmdbId: Number(s.key.split(":")[1]),
    title: s.key,
    year: 2020,
    facets: [
      { key: `kw:${s.key}`, mult: 1 },
      { key: `genre:${s.genre ?? "18"}`, mult: 1 },
      ...(s.anime ? [{ key: ANIME_UNIVERSE_KEY, mult: 1 }] : []),
    ],
    voteAverage: 7.5,
    voteCount: 2000,
    popularity: 10,
    source: s.library === false ? "vigie" : "library",
    jellyfinItemId: s.library === false ? null : `jf-${s.key}`,
    posterPath: "/p.jpg",
  },
  breakdown: { total: s.total, similarity: s.relevance, relevance: s.relevance, quality: 0.8, freshness: 1, popularityPenalty: 0, topContributors: [] },
});

/** Le pool comme `computePool` le rend : classé par total, puis la correspondance. */
function poolOf(specs: Spec[], animeShare = 0): PoolPayload {
  const entries = specs.map(entryOf).sort((a, b) => b.breakdown.total - a.breakdown.total);
  assignMatches(entries);
  return { generatedAt: "2026-10-15T00:00:00.000Z", strategyId: "test", poolSize: entries.length, seeds: [], entries, labels: {}, animeShare };
}

const OPTS = { exclude: new Set<string>(), vigieAvailable: true, inLibraryOnly: false, lambda: 0.7, profile: { facets: {}, signalCount: 0 } };

function expectOrdered(matches: Array<number | undefined>): void {
  const values = matches.map((m) => m ?? -1);
  for (let i = 1; i < values.length; i++) expect(values[i], `place ${i + 1} : ${values.join(", ")}`).toBeLessThanOrEqual(values[i - 1]);
}

/** Générateur déterministe (mulberry32) : les pools aléatoires se rejouent. */
function prng(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("ordre des rangées — la correspondance affichée décide de la place", () => {
  it("« Films pour vous » : le meilleur total sans proximité (63 %) ne passe plus devant les titres à 84 %", () => {
    // Le cas relevé : classé premier par la qualité et la notoriété, mais loin des goûts.
    const specs: Spec[] = [
      { key: "movie:1", total: 1.4, relevance: 0.03 },
      ...Array.from({ length: 30 }, (_, i) => ({ key: `movie:${i + 2}`, total: 1.3 - i * 0.02, relevance: 0.6, genre: String(i % 5) })),
    ];
    const pool = poolOf(specs);
    expect(pool.entries[0].match).toBe(62);
    const row = buildRow(pool, "forYouMovies", OPTS)!;
    const matches = row.items.map((i) => i.match);
    expect(row.items[0].key).not.toBe("movie:1");
    expect(row.items[0].match).toBe(Math.max(...matches.map((m) => m ?? 0)));
    expectOrdered(matches);
  });

  it("toutes les rangées du pool, sur des pools aléatoires : tête = meilleure correspondance, ordre décroissant", () => {
    const rows = ["forYou", "forYouMovies", "inLibrary", "discover", "anime", "exploration"];
    for (let seed = 1; seed <= 60; seed++) {
      const rand = prng(seed);
      const specs: Spec[] = Array.from({ length: 120 }, (_, i) => ({
        key: `${i % 3 === 0 ? "tv" : "movie"}:${i + 1}`,
        mediaType: i % 3 === 0 ? "tv" : "movie",
        total: rand() * 1.5,
        relevance: rand() < 0.25 ? rand() * 0.1 : rand() * 0.8,
        anime: rand() < 0.3,
        genre: String(Math.floor(rand() * 6)),
        library: rand() < 0.6,
      }));
      const pool = poolOf(specs, 0.3);
      for (const key of rows) {
        const row = buildRow(pool, key, { ...OPTS, lambda: 0.3 + rand() * 0.6 });
        if (!row || row.items.length === 0) continue;
        const matches = row.items.map((i) => i.match);
        expect(row.items[0].match, `${key}, graine ${seed}`).toBe(Math.max(...matches.map((m) => m ?? 0)));
        expectOrdered(matches);
      }
    }
  });

  it("« Pour vous » garde ses pas de côté marqués, à la place de leur correspondance", () => {
    const pool = poolOf(Array.from({ length: 60 }, (_, i) => ({ key: `movie:${i + 1}`, total: 1.5 - i * 0.02, relevance: 0.1 + (i % 7) * 0.1, genre: String(i % 9) })));
    const row = buildRow(pool, "forYou", { ...OPTS, lambda: 0.3 })!;
    expect(row.items.some((i) => i.exploration)).toBe(true);
    for (const item of row.items.filter((i) => i.exploration)) expect(item.reasons[0]).toEqual({ kind: "exploration" });
    expectOrdered(row.items.map((i) => i.match));
  });

  it("à correspondance égale, l'ordre de la sélection départage ; un pool sans correspondance garde le sien", () => {
    const picked = [{ key: "a", match: 80 }, { key: "b", match: 90 }, { key: "c", match: 80 }, { key: "d", match: 90 }];
    expect(inDisplayOrder(picked).map((i) => i.key)).toEqual(["b", "d", "a", "c"]);
    const legacy: Array<{ key: string; match?: number }> = [{ key: "x" }, { key: "y" }, { key: "z" }];
    expect(inDisplayOrder(legacy).map((i) => i.key)).toEqual(["x", "y", "z"]);
  });

  it("rangées globales : du mieux annoncé au moins bien, le meilleur total peu proche (78 %) derrière", () => {
    const pool = poolOf([
      // Juste au-dessus de la porte des rangées globales (proximité 0,25).
      { key: "movie:1", total: 1.4, relevance: 0.26 },
      { key: "movie:2", total: 1.3, relevance: 0.6 },
      { key: "movie:3", total: 1.2, relevance: 0.6 },
      { key: "movie:4", total: 0.2, relevance: 0.6 },
    ]);
    const served = gateGlobalRow<{ key: string; match?: number }>("trending", [{ key: "movie:1" }, { key: "movie:4" }, { key: "movie:2" }, { key: "movie:3" }], pool);
    expectOrdered(served.map((i) => i.match));
    expect(served[0].key).toBe("movie:2");
  });
});
