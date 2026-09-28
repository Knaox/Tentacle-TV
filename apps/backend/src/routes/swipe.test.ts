/**
 * La route des verdicts d'Affiner, de bout en bout (auth réelle, Prisma en
 * mémoire) : chaque verdict qui change le « j'aime » d'un titre passe au
 * cœur de la bibliothèque le verdict d'AVANT et celui d'après — c'est ce qui
 * permet à une annulation, ou à un refus qui remplace un like, de défaire le
 * cœur posé.
 */

import Fastify from "fastify";
import { ZodError } from "zod";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface Row {
  jellyfinUserId: string;
  mediaType: string;
  tmdbId: number;
  verdict: string;
}
const rows: Row[] = [];
const synced: Array<[string, string, number, string | null, string | null]> = [];
const pokes: string[] = [];

vi.mock("../services/configStore", () => ({ getJellyfinUrl: () => "http://jf.test" }));
vi.mock("../services/jwt", () => ({
  verifyImpersonationToken: async () => null,
  verifyDeviceToken: async () => null,
  hashToken: (value: string) => value,
}));
vi.mock("../services/reco/jobs", () => ({
  SWIPE_POOL_REGEN_MIN_AGE_MS: 180_000,
  pokeProfile: (userId: string) => pokes.push(userId),
}));
vi.mock("../services/swipe/deckService", () => ({ buildDeck: async () => ({ cards: [] }) }));
vi.mock("../services/swipe/cardDetails", () => ({ cardDetails: async () => ({}) }));
vi.mock("../services/swipe/swipeFavorites", () => ({
  syncSwipeFavorite: async (userId: string, mediaType: string, tmdbId: number, before: string | null, after: string | null) => {
    synced.push([userId, mediaType, tmdbId, before, after]);
  },
}));

type Key = { jellyfinUserId: string; mediaType: string; tmdbId: number };
const find = (k: Key) =>
  rows.find((r) => r.jellyfinUserId === k.jellyfinUserId && r.mediaType === k.mediaType && r.tmdbId === k.tmdbId);

vi.mock("../services/db", () => ({
  hasPrisma: () => true,
  getPrisma: () => ({
    userSwipe: {
      findUnique: async (args: { where: { jellyfinUserId_mediaType_tmdbId: Key } }) => {
        const row = find(args.where.jellyfinUserId_mediaType_tmdbId);
        return row ? { verdict: row.verdict } : null;
      },
      upsert: async (args: { where: { jellyfinUserId_mediaType_tmdbId: Key }; create: Row; update: { verdict: string } }) => {
        const row = find(args.where.jellyfinUserId_mediaType_tmdbId);
        if (row) row.verdict = args.update.verdict;
        else rows.push({ ...args.create });
      },
      deleteMany: async (args: { where: Key }) => {
        const row = find(args.where);
        if (!row) return { count: 0 };
        rows.splice(rows.indexOf(row), 1);
        return { count: 1 };
      },
    },
  }),
}));

import { swipeRoutes } from "./swipe";

beforeEach(() => {
  rows.length = 0;
  synced.length = 0;
  pokes.length = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes("/Users/Me")) {
        return new Response(JSON.stringify({ Id: "u1", Name: "banc", Policy: { IsAdministrator: false } }), { status: 200 });
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
  await app.register(swipeRoutes, { prefix: "/api/swipe" });
  return app;
}

const headers = { "x-emby-token": "jeton-banc" };
const judge = (app: Awaited<ReturnType<typeof makeApp>>, verdict: string) =>
  app.inject({ method: "POST", url: "/api/swipe", headers, payload: { mediaType: "movie", tmdbId: 603, verdict } });

describe("/api/swipe et le cœur de la bibliothèque", () => {
  it("un premier like passe (aucun, like) ; un refus qui le remplace passe (like, refus)", async () => {
    const app = await makeApp();
    expect((await judge(app, "like")).json()).toEqual({ ok: true });
    await judge(app, "dislike");
    expect(synced).toEqual([
      ["u1", "movie", 603, null, "like"],
      ["u1", "movie", 603, "like", "dislike"],
    ]);
    expect(rows).toEqual([{ jellyfinUserId: "u1", mediaType: "movie", tmdbId: 603, verdict: "dislike" }]);
    await app.close();
  });

  it("l'annulation passe le verdict retiré, puis relance le goût", async () => {
    const app = await makeApp();
    await judge(app, "superlike");
    synced.length = 0;
    pokes.length = 0;
    const res = await app.inject({ method: "DELETE", url: "/api/swipe/movie/603", headers });
    expect(res.json()).toEqual({ ok: true, removed: true });
    expect(synced).toEqual([["u1", "movie", 603, "superlike", null]]);
    expect(pokes).toEqual(["u1"]);
    await app.close();
  });

  it("annuler ce qui n'existe pas ne touche à rien", async () => {
    const app = await makeApp();
    const res = await app.inject({ method: "DELETE", url: "/api/swipe/tv/1399", headers });
    expect(res.json()).toEqual({ ok: true, removed: false });
    expect(synced).toEqual([]);
    expect(pokes).toEqual([]);
    await app.close();
  });

  it("refuse sans jeton, et refuse un verdict inconnu", async () => {
    const app = await makeApp();
    expect((await app.inject({ method: "POST", url: "/api/swipe", payload: {} })).statusCode).toBe(401);
    expect((await judge(app, "love")).statusCode).toBe(400);
    expect(synced).toEqual([]);
    await app.close();
  });
});
