/**
 * GET/PUT /api/preferences/home-layout : le catalogue des rangées suit les
 * capacités du serveur, le défaut d'un compte sans ligne en découle, le PUT
 * accepte toute clé connue quel que soit l'état des capacités, et une ligne
 * illisible retombe sur le catalogue. Prisma en Map mémoire, auth réelle
 * contre un faux /Users/Me (motif preferences.playback.test.ts).
 */

import Fastify from "fastify";
import { ZodError } from "zod";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface FakeRow extends Record<string, unknown> {
  jellyfinUserId: string;
}
const rows = new Map<string, FakeRow>();
const caps = vi.hoisted(() => ({ tmdb: true, seerr: null as { url: string } | null }));

vi.mock("../services/configStore", () => ({
  getJellyfinUrl: () => "http://jf.test",
}));
vi.mock("../services/jwt", () => ({
  verifyImpersonationToken: async () => null,
  verifyDeviceToken: async () => null,
  hashToken: (value: string) => value,
}));
vi.mock("../services/tmdb/client", () => ({ tmdbConfigured: () => caps.tmdb }));
vi.mock("../services/seerConfig", () => ({ getSeerrConfig: () => caps.seerr }));
vi.mock("../services/db", () => ({
  hasPrisma: () => true,
  getPrisma: () => ({
    homeLayout: {
      findUnique: async (args: { where: { jellyfinUserId: string } }) =>
        rows.get(args.where.jellyfinUserId) ?? null,
      upsert: async (args: {
        where: { jellyfinUserId: string };
        create: FakeRow;
        update: Record<string, unknown>;
      }) => {
        const existing = rows.get(args.where.jellyfinUserId);
        const row = existing ? { ...existing, ...args.update } : { ...args.create };
        rows.set(args.where.jellyfinUserId, row);
        return row;
      },
    },
  }),
}));

import { defaultHomeLayout, registerHomeLayoutRoutes } from "./preferences.homeLayout";
import { requireAuth } from "../middleware/auth";
import { homeRowCatalog } from "../services/homeRowCatalog";

beforeEach(() => {
  rows.clear();
  caps.tmdb = true;
  caps.seerr = null;
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
  await app.register(async (scope) => {
    scope.addHook("preHandler", requireAuth);
    registerHomeLayoutRoutes(scope);
  }, { prefix: "/api/preferences" });
  return app;
}

const headers = { "x-emby-token": "jeton-banc" };
const URL_PATH = "/api/preferences/home-layout";
/** Le catalogue d'un serveur avec clé TMDB et sans Vigie — l'état des tests. */
const FULL = homeRowCatalog({ tmdb: true, vigie: false });

const layoutWith = (layoutRows: Array<{ key: string; enabled: boolean }>) => ({
  heroMode: "resume",
  heroFixedItemId: null,
  rows: layoutRows,
  cardDensity: "normal",
});

describe("GET/PUT /api/preferences/home-layout", () => {
  it("refuse sans jeton", async () => {
    const app = await makeApp();
    const response = await app.inject({ method: "GET", url: URL_PATH });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it("sans ligne : le défaut EST le catalogue, stored=false, héros reco", async () => {
    const app = await makeApp();
    const response = await app.inject({ method: "GET", url: URL_PATH, headers });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ stored: false, layout: defaultHomeLayout(FULL), catalog: FULL });
    expect(response.json().layout.heroMode).toBe("reco");
    await app.close();
  });

  it("sans clé TMDB : le catalogue se réduit aux génériques, actives d'entrée", async () => {
    caps.tmdb = false;
    const app = await makeApp();
    const { catalog, layout } = (await app.inject({ method: "GET", url: URL_PATH, headers })).json();
    expect(catalog.map((r: { key: string }) => r.key)).toEqual([
      "resume", "nextUp", "watched", "watchlist", "favorites", "reco:serverPulse", "reco:bestOfLibrary",
    ]);
    expect(layout.rows.find((r: { key: string }) => r.key === "reco:serverPulse").enabled).toBe(true);
    await app.close();
  });

  it("PUT avec favoris et rangées globales, puis GET : aller-retour, catalogue joint", async () => {
    const app = await makeApp();
    const payload = layoutWith([
      { key: "resume", enabled: true },
      { key: "favorites", enabled: true },
      { key: "reco:trending", enabled: true },
      { key: "reco:serverPulse", enabled: false },
      { key: "reco:bestOfLibrary", enabled: true },
      { key: "library:abc-123", enabled: true },
    ]);
    const written = await app.inject({ method: "PUT", url: URL_PATH, headers, payload });
    expect(written.statusCode).toBe(200);
    expect(written.json()).toEqual({ ok: true });

    const readBack = (await app.inject({ method: "GET", url: URL_PATH, headers })).json();
    expect(readBack).toEqual({ stored: true, layout: payload, catalog: FULL });
    await app.close();
  });

  it("PUT « Pour vous » sans clé TMDB : accepté — la mise en page survit aux capacités", async () => {
    caps.tmdb = false;
    const app = await makeApp();
    const payload = layoutWith([{ key: "reco:forYou", enabled: true }]);
    expect((await app.inject({ method: "PUT", url: URL_PATH, headers, payload })).statusCode).toBe(200);
    const readBack = (await app.inject({ method: "GET", url: URL_PATH, headers })).json();
    expect(readBack.layout.rows).toEqual(payload.rows);
    expect(readBack.catalog.map((r: { key: string }) => r.key)).not.toContain("reco:forYou");
    await app.close();
  });

  it("PUT avec une clé inconnue : 400, rien n'est écrit", async () => {
    const app = await makeApp();
    const payload = layoutWith([{ key: "reco:banana", enabled: true }]);
    expect((await app.inject({ method: "PUT", url: URL_PATH, headers, payload })).statusCode).toBe(400);
    expect(rows.size).toBe(0);
    await app.close();
  });

  it("une ligne illisible retombe sur le catalogue, les autres champs restent", async () => {
    rows.set("u1", {
      jellyfinUserId: "u1",
      heroMode: "resume",
      heroFixedItemId: null,
      rows: "{pas du json",
      cardDensity: "large",
    });
    const app = await makeApp();
    const readBack = (await app.inject({ method: "GET", url: URL_PATH, headers })).json();
    expect(readBack).toEqual({
      stored: true,
      layout: { heroMode: "resume", heroFixedItemId: null, rows: FULL, cardDensity: "large" },
      catalog: FULL,
    });
    await app.close();
  });
});
