/**
 * Le rattrapage des likes d'Affiner d'avant le cœur : une fois, et une seule
 * — rejoué à chaque démarrage, il remettrait un cœur que l'utilisateur a
 * retiré depuis. Éprouvés : likes et coups de cœur mis de côté (pas les
 * refus ni les « passer »), la marque posée même sans like, le balayage
 * lancé seulement s'il y a de quoi, et le second démarrage qui ne fait rien.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const config = new Map<string, string>();
const swipes: Array<{ jellyfinUserId: string; mediaType: string; tmdbId: number; verdict: string }> = [];
const pending: Array<Record<string, unknown>> = [];
const sweep = vi.fn(async () => 0);

vi.mock("../watchlistPending", () => ({ sweepPendingWatchlist: () => sweep() }));
vi.mock("../db", () => ({
  hasPrisma: () => true,
  getPrisma: () => ({
    serverConfig: {
      findUnique: async (args: { where: { key: string } }) =>
        config.has(args.where.key) ? { key: args.where.key, value: config.get(args.where.key) } : null,
      upsert: async (args: { create: { key: string; value: string } }) => {
        if (!config.has(args.create.key)) config.set(args.create.key, args.create.value);
      },
    },
    userSwipe: {
      findMany: async (args: { where: { verdict: { in: string[] } } }) =>
        swipes
          .filter((s) => args.where.verdict.in.includes(s.verdict))
          .map(({ jellyfinUserId, mediaType, tmdbId }) => ({ jellyfinUserId, mediaType, tmdbId })),
    },
    watchlistPending: {
      createMany: async (args: { data: Array<Record<string, unknown>> }) => {
        pending.push(...args.data);
        return { count: args.data.length };
      },
    },
  }),
}));

import { SWIPE_FAVORITES_BACKFILL_KEY, backfillSwipeFavorites } from "./swipeFavoritesBackfill";

beforeEach(() => {
  config.clear();
  swipes.length = 0;
  pending.length = 0;
  sweep.mockClear();
  vi.spyOn(console, "log").mockImplementation(() => undefined);
});

describe("rattrapage des likes d'Affiner", () => {
  it("met de côté le cœur de chaque like et coup de cœur, puis balaie", async () => {
    swipes.push(
      { jellyfinUserId: "u1", mediaType: "movie", tmdbId: 603, verdict: "like" },
      { jellyfinUserId: "u1", mediaType: "tv", tmdbId: 1399, verdict: "superlike" },
      { jellyfinUserId: "u2", mediaType: "movie", tmdbId: 11, verdict: "dislike" },
      { jellyfinUserId: "u2", mediaType: "movie", tmdbId: 12, verdict: "skip" },
    );
    expect(await backfillSwipeFavorites()).toBe(2);
    expect(pending).toEqual([
      { jellyfinUserId: "u1", mediaType: "movie", tmdbId: 603, flag: "favorite" },
      { jellyfinUserId: "u1", mediaType: "tv", tmdbId: 1399, flag: "favorite" },
    ]);
    expect(sweep).toHaveBeenCalledTimes(1);
    expect(config.has(SWIPE_FAVORITES_BACKFILL_KEY)).toBe(true);
  });

  it("ne se rejoue jamais : le second démarrage ne fait rien", async () => {
    swipes.push({ jellyfinUserId: "u1", mediaType: "movie", tmdbId: 603, verdict: "like" });
    await backfillSwipeFavorites();
    pending.length = 0;
    sweep.mockClear();
    expect(await backfillSwipeFavorites()).toBe(0);
    expect(pending).toEqual([]);
    expect(sweep).not.toHaveBeenCalled();
  });

  it("sans like, pose la marque et ne balaie pas", async () => {
    expect(await backfillSwipeFavorites()).toBe(0);
    expect(config.has(SWIPE_FAVORITES_BACKFILL_KEY)).toBe(true);
    expect(sweep).not.toHaveBeenCalled();
  });
});
