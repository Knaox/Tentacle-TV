/**
 * La route /api/watchlist/auto-retired de bout en bout : auth réelle (Jellyfin
 * bouchonné via le fetch global, motif preferences.playback.test.ts), Prisma en
 * Map mémoire, écritures idempotentes, refus d'un id qui n'a pas la forme d'un
 * GUID.
 */

import Fastify from "fastify";
import { ZodError } from "zod";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface Row {
  seriesId: string;
  jellyfinUserId: string;
  retiredAt: Date;
}
const rows = new Map<string, Row>(); // clé `${seriesId}|${jellyfinUserId}`

vi.mock("../services/configStore", () => ({
  getJellyfinUrl: () => "http://jf.test",
}));
vi.mock("../services/jwt", () => ({
  verifyImpersonationToken: async () => null,
  verifyDeviceToken: async () => null,
  hashToken: (value: string) => value,
}));
vi.mock("../services/db", () => ({
  hasPrisma: () => true,
  getPrisma: () => ({
    watchlistAutoRetired: {
      findMany: async (args: { where: { jellyfinUserId: string } }) =>
        [...rows.values()]
          .filter((r) => r.jellyfinUserId === args.where.jellyfinUserId)
          .sort((a, b) => b.retiredAt.getTime() - a.retiredAt.getTime()),
      upsert: async (args: {
        where: { seriesId_jellyfinUserId: { seriesId: string; jellyfinUserId: string } };
        create: { seriesId: string; jellyfinUserId: string };
      }) => {
        const { seriesId, jellyfinUserId } = args.where.seriesId_jellyfinUserId;
        const key = `${seriesId}|${jellyfinUserId}`;
        const row = rows.get(key) ?? { ...args.create, retiredAt: new Date() };
        rows.set(key, row);
        return row;
      },
      deleteMany: async (args: { where: { seriesId: string; jellyfinUserId: string } }) => ({
        count: rows.delete(`${args.where.seriesId}|${args.where.jellyfinUserId}`) ? 1 : 0,
      }),
    },
  }),
}));

import { watchlistRoutes } from "./watchlist";

beforeEach(() => {
  rows.clear();
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
    if (err instanceof ZodError) {
      return reply.status(400).send({ message: "Validation error" });
    }
    const message = err instanceof Error ? err.message : "Erreur";
    return reply.status(500).send({ message });
  });
  await app.register(watchlistRoutes, { prefix: "/api/watchlist" });
  return app;
}

const headers = { "x-emby-token": "jeton-banc" };
const SERIES = "5f1c3e2a-9b7d-4c1e-8a2f-0d3b4c5e6f70";

describe("/api/watchlist/auto-retired", () => {
  it("refuse sans jeton", async () => {
    const app = await makeApp();
    const response = await app.inject({ method: "GET", url: "/api/watchlist/auto-retired" });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it("refuse un id qui n'a pas la forme d'un GUID", async () => {
    const app = await makeApp();
    const response = await app.inject({
      method: "PUT",
      url: "/api/watchlist/auto-retired",
      headers,
      payload: { seriesId: "pas un guid !" },
    });
    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it("mémorise un retrait une seule fois, même demandé deux fois", async () => {
    const app = await makeApp();
    for (let i = 0; i < 2; i++) {
      const response = await app.inject({
        method: "PUT",
        url: "/api/watchlist/auto-retired",
        headers,
        payload: { seriesId: SERIES },
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ ok: true });
    }
    const list = await app.inject({ method: "GET", url: "/api/watchlist/auto-retired", headers });
    expect(list.json()).toEqual([SERIES]);
    await app.close();
  });

  it("oublie un suivi, et ne bronche pas sur un suivi inconnu", async () => {
    const app = await makeApp();
    await app.inject({ method: "PUT", url: "/api/watchlist/auto-retired", headers, payload: { seriesId: SERIES } });

    const removed = await app.inject({ method: "DELETE", url: `/api/watchlist/auto-retired/${SERIES}`, headers });
    expect(removed.statusCode).toBe(200);
    expect(removed.json()).toEqual({ ok: true });

    const list = await app.inject({ method: "GET", url: "/api/watchlist/auto-retired", headers });
    expect(list.json()).toEqual([]);

    const again = await app.inject({ method: "DELETE", url: `/api/watchlist/auto-retired/${SERIES}`, headers });
    expect(again.statusCode).toBe(200);
    expect(again.json()).toEqual({ ok: true });
    await app.close();
  });
});
