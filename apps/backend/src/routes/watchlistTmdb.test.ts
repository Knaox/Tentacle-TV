/**
 * « Ma liste » par identité TMDB, de bout en bout (auth réelle, Jellyfin
 * bouchonné, Prisma en mémoire) : un titre déjà là entre tout de suite dans
 * la liste, un titre absent est mis de côté (une seule fois), et le retrait
 * défait l'un ou l'autre sans toucher Jellyfin pour rien.
 */

import Fastify from "fastify";
import { ZodError } from "zod";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface Row {
  jellyfinUserId: string;
  mediaType: string;
  tmdbId: number;
  flag: string;
  createdAt: Date;
}
const rows: Row[] = [];
const library = new Map<string, string>(); // « movie:603 » → id Jellyfin
const calls: string[] = [];

vi.mock("../services/configStore", () => ({
  getJellyfinUrl: () => "http://jf.test",
}));
vi.mock("../services/jwt", () => ({
  verifyImpersonationToken: async () => null,
  verifyDeviceToken: async () => null,
  hashToken: (value: string) => value,
}));
vi.mock("../services/jellyfinTmdbLookup", () => ({
  findLibraryItemByTmdb: async (tmdbId: number, mediaType: string) => {
    calls.push(`lookup ${mediaType}:${tmdbId}`);
    const id = library.get(`${mediaType}:${tmdbId}`);
    return id ? { kind: "found", id } : { kind: "missing" };
  },
}));
vi.mock("../services/wsManager", () => ({
  broadcastToUser: (userId: string, carousel: string) => calls.push(`broadcast ${userId} ${carousel}`),
}));
vi.mock("../services/reco/jobs", () => ({ pokeProfile: () => undefined }));
vi.mock("../services/jellyfinLikes", () => ({
  likeItemForUser: async (userId: string, itemId: string) => { calls.push(`like ${userId} ${itemId}`); return true; },
  unlikeItemForUser: async (userId: string, itemId: string) => { calls.push(`unlike ${userId} ${itemId}`); return true; },
}));

type Where = { jellyfinUserId: string; mediaType?: string; tmdbId?: number; flag?: string };
const matches = (r: Row, w: Where) =>
  r.jellyfinUserId === w.jellyfinUserId && (w.mediaType === undefined || r.mediaType === w.mediaType)
  && (w.tmdbId === undefined || r.tmdbId === w.tmdbId) && (w.flag === undefined || r.flag === w.flag);

vi.mock("../services/db", () => ({
  hasPrisma: () => true,
  getPrisma: () => ({
    watchlistPending: {
      findMany: async (args: { where: Where }) => rows.filter((r) => matches(r, args.where)).reverse(),
      upsert: async (args: { create: Omit<Row, "createdAt"> }) => {
        // Le drapeau fait partie de la clé : Ma liste et J'aime sont deux lignes.
        const w = args.create;
        if (!rows.some((r) => matches(r, w))) rows.push({ ...w, createdAt: new Date() });
        return w;
      },
      deleteMany: async (args: { where: Where }) => {
        const before = rows.length;
        for (let i = rows.length - 1; i >= 0; i--) if (matches(rows[i], args.where)) rows.splice(i, 1);
        return { count: before - rows.length };
      },
    },
  }),
}));

import { watchlistRoutes } from "./watchlist";

beforeEach(() => {
  rows.length = 0;
  library.clear();
  calls.length = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes("/Users/Me")) {
        return new Response(
          JSON.stringify({ Id: "u1", Name: "banc", Policy: { IsAdministrator: false } }),
          { status: 200 },
        );
      }
      return new Response("{}", { status: 404 });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function makeApp() {
  const app = Fastify();
  app.setErrorHandler((err: unknown, _req, reply) => {
    if (err instanceof ZodError) return reply.status(400).send({ message: "Validation error" });
    return reply.status(500).send({ message: err instanceof Error ? err.message : "Erreur" });
  });
  await app.register(watchlistRoutes, { prefix: "/api/watchlist" });
  return app;
}

const headers = { "x-emby-token": "jeton-banc" };

describe("/api/watchlist/tmdb", () => {
  it("refuse sans jeton, et refuse un type ou un identifiant mal formés", async () => {
    const app = await makeApp();
    expect((await app.inject({ method: "GET", url: "/api/watchlist/pending" })).statusCode).toBe(401);
    const badType = await app.inject({ method: "PUT", url: "/api/watchlist/tmdb", headers, payload: { mediaType: "series", tmdbId: 1 } });
    expect(badType.statusCode).toBe(400);
    const badId = await app.inject({ method: "DELETE", url: "/api/watchlist/tmdb/movie/abc", headers });
    expect(badId.statusCode).toBe(400);
    await app.close();
  });

  it("un titre déjà dans la bibliothèque entre tout de suite dans Ma liste", async () => {
    library.set("movie:603", "m1");
    const app = await makeApp();
    const res = await app.inject({ method: "PUT", url: "/api/watchlist/tmdb", headers, payload: { mediaType: "movie", tmdbId: 603 } });
    expect(res.json()).toEqual({ state: "listed", itemId: "m1" });
    expect(calls).toEqual(["lookup movie:603", "like u1 m1", "broadcast u1 watchlist"]);
    expect(rows).toHaveLength(0);
    await app.close();
  });

  it("un titre absent est mis de côté une seule fois, et se lit dans /pending", async () => {
    const app = await makeApp();
    for (let i = 0; i < 2; i++) {
      const res = await app.inject({ method: "PUT", url: "/api/watchlist/tmdb", headers, payload: { mediaType: "tv", tmdbId: 1399 } });
      expect(res.json()).toEqual({ state: "pending" });
    }
    const pending = await app.inject({ method: "GET", url: "/api/watchlist/pending", headers });
    expect(pending.json()).toEqual(["tv:1399"]);
    await app.close();
  });

  it("retirer un titre mis de côté ne touche pas Jellyfin", async () => {
    const app = await makeApp();
    await app.inject({ method: "PUT", url: "/api/watchlist/tmdb", headers, payload: { mediaType: "tv", tmdbId: 1399 } });
    calls.length = 0;
    const res = await app.inject({ method: "DELETE", url: "/api/watchlist/tmdb/tv/1399", headers });
    expect(res.json()).toEqual({ state: "none" });
    expect(calls).toEqual([]);
    expect(rows).toHaveLength(0);
    await app.close();
  });

  it("un cœur d'Affiner qui attend son titre n'est ni lu dans /pending, ni retiré avec Ma liste", async () => {
    rows.push({ jellyfinUserId: "u1", mediaType: "tv", tmdbId: 1399, flag: "favorite", createdAt: new Date() });
    const app = await makeApp();
    await app.inject({ method: "PUT", url: "/api/watchlist/tmdb", headers, payload: { mediaType: "tv", tmdbId: 1399 } });
    expect(rows.map((r) => r.flag).sort()).toEqual(["favorite", "watchlist"]);
    expect((await app.inject({ method: "GET", url: "/api/watchlist/pending", headers })).json()).toEqual(["tv:1399"]);
    await app.inject({ method: "DELETE", url: "/api/watchlist/tmdb/tv/1399", headers });
    expect(rows.map((r) => r.flag)).toEqual(["favorite"]);
    expect((await app.inject({ method: "GET", url: "/api/watchlist/pending", headers })).json()).toEqual([]);
    await app.close();
  });

  it("retirer un titre arrivé le retire de Ma liste chez Jellyfin", async () => {
    library.set("movie:603", "m1");
    const app = await makeApp();
    const res = await app.inject({ method: "DELETE", url: "/api/watchlist/tmdb/movie/603", headers });
    expect(res.json()).toEqual({ state: "none" });
    expect(calls).toEqual(["lookup movie:603", "unlike u1 m1", "broadcast u1 watchlist"]);
    await app.close();
  });
});
