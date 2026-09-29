/**
 * « J'aime » par identité TMDB, de bout en bout (auth réelle, Jellyfin
 * bouchonné, Prisma en mémoire) : un titre déjà là reçoit le cœur tout de
 * suite ; un titre absent devient un like du catalogue (le goût de la reco le
 * lit aussitôt) ET un cœur qui attend son arrivée ; le retrait défait l'un ou
 * l'autre sans toucher Jellyfin pour rien. Le cœur d'Affiner qui attend son
 * titre se lit comme les autres.
 */

import Fastify from "fastify";
import { ZodError } from "zod";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface PendingRow {
  jellyfinUserId: string;
  mediaType: string;
  tmdbId: number;
  flag: string;
  createdAt: Date;
}
interface LikeRow {
  jellyfinUserId: string;
  mediaType: string;
  tmdbId: number;
  createdAt: Date;
}
const pending: PendingRow[] = [];
const likes: LikeRow[] = [];
const library = new Map<string, string>(); // « movie:603 » → id Jellyfin
const calls: string[] = [];
let jellyfinAccepts = true;

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
vi.mock("../services/reco/jobs", () => ({ pokeProfile: (userId: string) => calls.push(`poke ${userId}`) }));
vi.mock("../services/reco/candidates/libraryMemo", () => ({
  patchLibraryMemo: (userId: string, key: string, patch: { isFavorite?: boolean }) => {
    calls.push(`memo ${userId} ${key} ${patch.isFavorite}`);
    return null;
  },
}));
vi.mock("../services/jellyfinLikes", () => ({
  favoriteItemForUser: async (userId: string, itemId: string) => {
    calls.push(`favorite ${userId} ${itemId}`);
    return jellyfinAccepts;
  },
  unfavoriteItemForUser: async (userId: string, itemId: string) => {
    calls.push(`unfavorite ${userId} ${itemId}`);
    return jellyfinAccepts;
  },
}));

type Where = { jellyfinUserId: string; mediaType?: string; tmdbId?: number; flag?: string };
const matches = (r: { jellyfinUserId: string; mediaType: string; tmdbId: number; flag?: string }, w: Where) =>
  r.jellyfinUserId === w.jellyfinUserId && (w.mediaType === undefined || r.mediaType === w.mediaType)
  && (w.tmdbId === undefined || r.tmdbId === w.tmdbId) && (w.flag === undefined || r.flag === w.flag);
const remove = <T extends { jellyfinUserId: string; mediaType: string; tmdbId: number }>(list: T[], w: Where) => {
  const before = list.length;
  for (let i = list.length - 1; i >= 0; i--) if (matches(list[i], w)) list.splice(i, 1);
  return { count: before - list.length };
};

vi.mock("../services/db", () => ({
  hasPrisma: () => true,
  getPrisma: () => ({
    watchlistPending: {
      findMany: async (args: { where: Where }) => pending.filter((r) => matches(r, args.where)).reverse(),
      upsert: async (args: { create: Omit<PendingRow, "createdAt"> }) => {
        const w = args.create;
        if (!pending.some((r) => matches(r, w))) pending.push({ ...w, createdAt: new Date() });
        return w;
      },
      deleteMany: async (args: { where: Where }) => remove(pending, args.where),
    },
    userLike: {
      findMany: async (args: { where: Where }) => likes.filter((r) => matches(r, args.where)).reverse(),
      upsert: async (args: { create: Omit<LikeRow, "createdAt"> }) => {
        const w = args.create;
        if (!likes.some((r) => matches(r, w))) likes.push({ ...w, createdAt: new Date() });
        return w;
      },
      deleteMany: async (args: { where: Where }) => remove(likes, args.where),
    },
  }),
}));

import { likeRoutes } from "./likes";

beforeEach(() => {
  pending.length = 0;
  likes.length = 0;
  library.clear();
  calls.length = 0;
  jellyfinAccepts = true;
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
  await app.register(likeRoutes, { prefix: "/api/likes" });
  return app;
}

const headers = { "x-emby-token": "jeton-banc" };
const put = (app: Awaited<ReturnType<typeof makeApp>>, mediaType: string, tmdbId: number) =>
  app.inject({ method: "PUT", url: "/api/likes/tmdb", headers, payload: { mediaType, tmdbId } });

describe("/api/likes/tmdb", () => {
  it("refuse sans jeton, et refuse un type ou un identifiant mal formés", async () => {
    const app = await makeApp();
    expect((await app.inject({ method: "GET", url: "/api/likes/pending" })).statusCode).toBe(401);
    expect((await put(app, "series", 1)).statusCode).toBe(400);
    expect((await app.inject({ method: "DELETE", url: "/api/likes/tmdb/tv/abc", headers })).statusCode).toBe(400);
    await app.close();
  });

  it("un titre déjà dans la bibliothèque reçoit le cœur tout de suite, sans rien mettre de côté", async () => {
    library.set("movie:603", "m1");
    const app = await makeApp();
    const res = await put(app, "movie", 603);
    expect(res.json()).toEqual({ state: "favorited", itemId: "m1" });
    expect(calls).toEqual(["lookup movie:603", "favorite u1 m1", "memo u1 movie:603 true", "broadcast u1 favorites", "poke u1"]);
    expect(pending).toHaveLength(0);
    expect(likes).toHaveLength(0);
    await app.close();
  });

  it("un titre absent devient un like du catalogue ET un cœur qui attend son arrivée — une seule fois", async () => {
    const app = await makeApp();
    for (let i = 0; i < 2; i++) expect((await put(app, "tv", 1399)).json()).toEqual({ state: "pending" });
    // Le vocabulaire de chaque table : « series » pour le like, « tv » pour la mise de côté.
    expect(likes.map((l) => `${l.mediaType}:${l.tmdbId}`)).toEqual(["series:1399"]);
    expect(pending.map((p) => `${p.mediaType}:${p.tmdbId}:${p.flag}`)).toEqual(["tv:1399:favorite"]);
    expect(calls.filter((c) => c.startsWith("poke"))).toHaveLength(2);
    expect((await app.inject({ method: "GET", url: "/api/likes/pending", headers })).json()).toEqual(["tv:1399"]);
    await app.close();
  });

  it("Jellyfin muet sur un titre présent : le like attend, le balayage posera le cœur", async () => {
    library.set("movie:603", "m1");
    jellyfinAccepts = false;
    const app = await makeApp();
    expect((await put(app, "movie", 603)).json()).toEqual({ state: "pending" });
    expect(pending.map((p) => p.flag)).toEqual(["favorite"]);
    await app.close();
  });

  it("/pending réunit les likes du catalogue et les cœurs d'Affiner qui attendent, sans Ma liste", async () => {
    pending.push(
      { jellyfinUserId: "u1", mediaType: "movie", tmdbId: 603, flag: "favorite", createdAt: new Date() },
      { jellyfinUserId: "u1", mediaType: "tv", tmdbId: 42, flag: "watchlist", createdAt: new Date() },
      { jellyfinUserId: "u2", mediaType: "tv", tmdbId: 7, flag: "favorite", createdAt: new Date() },
    );
    likes.push({ jellyfinUserId: "u1", mediaType: "series", tmdbId: 1399, createdAt: new Date() });
    const app = await makeApp();
    const res = await app.inject({ method: "GET", url: "/api/likes/pending", headers });
    expect((res.json() as string[]).sort()).toEqual(["movie:603", "tv:1399"]);
    await app.close();
  });

  it("ne plus aimer un titre absent efface le like et le cœur en attente, sans toucher Jellyfin", async () => {
    const app = await makeApp();
    await put(app, "tv", 1399);
    calls.length = 0;
    const res = await app.inject({ method: "DELETE", url: "/api/likes/tmdb/tv/1399", headers });
    expect(res.json()).toEqual({ state: "none" });
    expect(calls).toEqual(["poke u1"]);
    expect(pending).toHaveLength(0);
    expect(likes).toHaveLength(0);
    await app.close();
  });

  it("ne plus aimer un titre arrivé retire son cœur chez Jellyfin", async () => {
    library.set("movie:603", "m1");
    const app = await makeApp();
    const res = await app.inject({ method: "DELETE", url: "/api/likes/tmdb/movie/603", headers });
    expect(res.json()).toEqual({ state: "none" });
    expect(calls).toEqual(["lookup movie:603", "unfavorite u1 m1", "memo u1 movie:603 false", "broadcast u1 favorites", "poke u1"]);
    await app.close();
  });

  it("le retrait n'emporte pas « Ma liste à l'arrivée » du même titre", async () => {
    pending.push({ jellyfinUserId: "u1", mediaType: "tv", tmdbId: 1399, flag: "watchlist", createdAt: new Date() });
    const app = await makeApp();
    await put(app, "tv", 1399);
    await app.inject({ method: "DELETE", url: "/api/likes/tmdb/tv/1399", headers });
    expect(pending.map((p) => p.flag)).toEqual(["watchlist"]);
    await app.close();
  });
});
