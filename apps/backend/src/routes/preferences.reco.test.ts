/**
 * GET/PUT /api/preferences/reco : les défauts sont servis sans ligne, le PUT
 * fait l'aller-retour et prévient les autres appareils du compte (jamais
 * l'auteur), un corps invalide ne prévient personne, et changer « hors
 * bibliothèque » invalide le pool. Le GET porte aussi `vigieAvailable` : la
 * vérité du serveur sur le plugin, celle qui décide si l'interrupteur « hors
 * bibliothèque » a le droit d'exister chez le client. Prisma en Map mémoire,
 * auth réelle contre un faux /Users/Me (motif preferences.homeLayout.test.ts).
 */

import Fastify from "fastify";
import { ZodError } from "zod";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface FakeRow extends Record<string, unknown> {
  jellyfinUserId: string;
}
const rows = new Map<string, FakeRow>();
const spies = vi.hoisted(() => ({
  seerrConfig: vi.fn((): unknown => ({ url: "http://vigie.test", apiKey: "k" })),
  sendToUser: vi.fn(),
  pokePage: vi.fn(),
  invalidatePool: vi.fn(async (..._args: unknown[]) => undefined),
  bootstrapPool: vi.fn(async (..._args: unknown[]) => undefined),
}));

vi.mock("../services/configStore", () => ({
  getJellyfinUrl: () => "http://jf.test",
}));
vi.mock("../services/seerConfig", () => ({
  getSeerrConfig: () => spies.seerrConfig(),
}));
vi.mock("../services/jwt", () => ({
  verifyImpersonationToken: async () => null,
  verifyDeviceToken: async () => null,
  hashToken: (value: string) => value,
}));
vi.mock("../services/wsManager", () => ({
  sendToUser: (...args: unknown[]) => spies.sendToUser(...args),
}));
vi.mock("../services/reco/pageJobs", () => ({
  pokePage: (...args: unknown[]) => spies.pokePage(...args),
}));
vi.mock("../services/reco/poolStore", () => ({
  invalidatePool: (...args: unknown[]) => spies.invalidatePool(...args),
}));
vi.mock("../services/reco/generationJob", () => ({
  bootstrapPool: (...args: unknown[]) => spies.bootstrapPool(...args),
}));
vi.mock("../services/db", () => ({
  hasPrisma: () => true,
  getPrisma: () => ({
    recoSettings: {
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

import { DEFAULT_RECO_SETTINGS, registerRecoSettingsRoutes } from "./preferences.reco";
import { requireAuth } from "../middleware/auth";

beforeEach(() => {
  rows.clear();
  for (const spy of Object.values(spies)) spy.mockClear();
  spies.seerrConfig.mockReturnValue({ url: "http://vigie.test", apiKey: "k" });
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
    registerRecoSettingsRoutes(scope);
  }, { prefix: "/api/preferences" });
  return app;
}

const headers = { "x-emby-token": "jeton-banc" };
const URL_PATH = "/api/preferences/reco";
const SETTINGS = { ...DEFAULT_RECO_SETTINGS, community: false, explorationBalance: 40, providerFilter: [8] };

describe("GET/PUT /api/preferences/reco", () => {
  it("sans ligne : les défauts, stored=false", async () => {
    const app = await makeApp();
    const response = await app.inject({ method: "GET", url: URL_PATH, headers });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ stored: false, vigieAvailable: true, settings: DEFAULT_RECO_SETTINGS });
    await app.close();
  });

  it("PUT puis GET : aller-retour, et les autres appareils sont prévenus — pas l'auteur", async () => {
    const app = await makeApp();
    const written = await app.inject({ method: "PUT", url: URL_PATH, headers, payload: SETTINGS });
    expect(written.statusCode).toBe(200);
    expect(written.json()).toEqual({ ok: true });
    expect(spies.sendToUser).toHaveBeenCalledTimes(1);
    expect(spies.sendToUser).toHaveBeenCalledWith(
      "u1",
      { type: "preferences:update", scope: "reco-settings" },
      { exceptTokenHash: "jeton-banc" },
    );
    expect(spies.pokePage).toHaveBeenCalledWith("u1", "settings");
    const readBack = (await app.inject({ method: "GET", url: URL_PATH, headers })).json();
    expect(readBack).toEqual({ stored: true, vigieAvailable: true, settings: SETTINGS });
    await app.close();
  });

  it("Vigie absente ou coupée : vigieAvailable=false, le réglage stocké est intact", async () => {
    const app = await makeApp();
    await app.inject({ method: "PUT", url: URL_PATH, headers, payload: DEFAULT_RECO_SETTINGS });
    spies.seerrConfig.mockReturnValue(null);
    const read = (await app.inject({ method: "GET", url: URL_PATH, headers })).json();
    expect(read.vigieAvailable).toBe(false);
    // Le choix de l'utilisateur reste écrit : il reprend effet si Vigie revient.
    expect(read.settings.includeVigie).toBe(true);
    await app.close();
  });

  it("un corps invalide : 400, rien n'est écrit, personne n'est prévenu", async () => {
    const app = await makeApp();
    const payload = { ...DEFAULT_RECO_SETTINGS, explorationBalance: 150 };
    expect((await app.inject({ method: "PUT", url: URL_PATH, headers, payload })).statusCode).toBe(400);
    expect(rows.size).toBe(0);
    expect(spies.sendToUser).not.toHaveBeenCalled();
    await app.close();
  });

  it("changer « hors bibliothèque » invalide le pool et le relance ; un autre réglage non", async () => {
    const app = await makeApp();
    await app.inject({ method: "PUT", url: URL_PATH, headers, payload: { ...DEFAULT_RECO_SETTINGS, community: false } });
    expect(spies.invalidatePool).not.toHaveBeenCalled();
    await app.inject({ method: "PUT", url: URL_PATH, headers, payload: { ...DEFAULT_RECO_SETTINGS, includeVigie: false } });
    expect(spies.invalidatePool).toHaveBeenCalledWith("u1");
    expect(spies.bootstrapPool).toHaveBeenCalledWith("u1");
    await app.close();
  });
});
