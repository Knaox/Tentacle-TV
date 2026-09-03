import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PoolPayload } from "./generationJob";

interface Row {
  jellyfinUserId: string;
  rowKey: string;
  payload: string;
  generatedAt: Date;
  expiresAt: Date;
}
const rows = new Map<string, Row>();
const keyOf = (u: string, r: string) => `${u}|${r}`;

const prisma = {
  recommendationCache: {
    findUnique: vi.fn(async ({ where }: { where: { jellyfinUserId_rowKey: { jellyfinUserId: string; rowKey: string } } }) => {
      const w = where.jellyfinUserId_rowKey;
      const row = rows.get(keyOf(w.jellyfinUserId, w.rowKey));
      return row ? { ...row } : null;
    }),
    updateMany: vi.fn(
      async ({ where, data }: { where: { jellyfinUserId: string; rowKey: string; generatedAt: Date }; data: { payload: string } }) => {
        const row = rows.get(keyOf(where.jellyfinUserId, where.rowKey));
        if (!row || row.generatedAt.getTime() !== where.generatedAt.getTime()) return { count: 0 };
        row.payload = data.payload;
        return { count: 1 };
      }
    ),
  },
};

vi.mock("../db", () => ({ getPrisma: () => prisma }));

import { patchPool } from "./poolStore";

const pool = (): PoolPayload => ({
  generatedAt: "2026-09-04T00:00:00.000Z",
  strategyId: "test",
  poolSize: 1,
  seeds: [],
  labels: {},
  entries: [
    {
      candidate: { key: "movie:1", mediaType: "movie", tmdbId: 1, title: "t", year: null, facets: [], voteAverage: null, voteCount: null, popularity: null, source: "library" },
      breakdown: { total: 1, similarity: 1, quality: 1, freshness: 1, popularityPenalty: 0, topContributors: [] },
    },
  ],
});

beforeEach(() => {
  rows.clear();
  rows.set(keyOf("u1", "pool"), {
    jellyfinUserId: "u1",
    rowKey: "pool",
    payload: JSON.stringify(pool()),
    generatedAt: new Date("2026-09-04T00:00:00.000Z"),
    expiresAt: new Date("2026-09-11T00:00:00.000Z"),
  });
});

describe("patchPool", () => {
  it("écrit le pool muté sans toucher generatedAt ni expiresAt", async () => {
    const res = await patchPool("u1", (p) => {
      p.entries[0].providers = [283];
      return true;
    });
    expect(res).toBe("patched");
    const row = rows.get(keyOf("u1", "pool"))!;
    expect((JSON.parse(row.payload) as PoolPayload).entries[0].providers).toEqual([283]);
    expect(row.generatedAt.toISOString()).toBe("2026-09-04T00:00:00.000Z");
    expect(row.expiresAt.toISOString()).toBe("2026-09-11T00:00:00.000Z");
  });

  it("unchanged sans mutation, missing sans pool", async () => {
    expect(await patchPool("u1", () => false)).toBe("unchanged");
    expect(await patchPool("u2", () => true)).toBe("missing");
  });

  it("raced quand le pool a été régénéré entre la lecture et l'écriture", async () => {
    const res = await patchPool("u1", (p) => {
      // Une génération complète passe pendant le patch : generatedAt change.
      rows.get(keyOf("u1", "pool"))!.generatedAt = new Date("2026-09-04T01:00:00.000Z");
      p.entries[0].providers = [283];
      return true;
    });
    expect(res).toBe("raced");
    expect((JSON.parse(rows.get(keyOf("u1", "pool"))!.payload) as PoolPayload).entries[0].providers).toBeUndefined();
  });
});
