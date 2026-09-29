/**
 * GET/PUT /api/preferences/hints : rien de masqué sans ligne, masquer puis
 * réafficher fait l'aller-retour (et « rien de masqué » efface la ligne), les
 * autres appareils du compte sont prévenus — jamais l'auteur —, un rappel
 * inconnu ou un corps invalide est refusé sans rien écrire, et une ligne
 * illisible vaut « rien de masqué ». `server_config` en Map mémoire, auth
 * réelle contre un faux /Users/Me (motif preferences.reco.test.ts).
 */

import Fastify from "fastify";
import { ZodError } from "zod";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const config = new Map<string, string>();
const spies = vi.hoisted(() => ({ sendToUser: vi.fn() }));

vi.mock("../services/configStore", () => ({
  getJellyfinUrl: () => "http://jf.test",
}));
vi.mock("../services/jwt", () => ({
  verifyImpersonationToken: async () => null,
  verifyDeviceToken: async () => null,
  hashToken: (value: string) => value,
}));
vi.mock("../services/wsManager", () => ({
  sendToUser: (...args: unknown[]) => spies.sendToUser(...args),
}));
vi.mock("../services/db", () => ({
  hasPrisma: () => true,
  getPrisma: () => ({
    serverConfig: {
      findUnique: async (args: { where: { key: string } }) => {
        const value = config.get(args.where.key);
        return value === undefined ? null : { key: args.where.key, value };
      },
      upsert: async (args: { where: { key: string }; create: { value: string }; update: { value: string } }) => {
        const value = config.has(args.where.key) ? args.update.value : args.create.value;
        config.set(args.where.key, value);
        return { key: args.where.key, value };
      },
      deleteMany: async (args: { where: { key: string } }) => ({ count: config.delete(args.where.key) ? 1 : 0 }),
    },
  }),
}));

import { hintsConfigKey, registerHintsRoutes } from "./preferences.hints";
import { requireAuth } from "../middleware/auth";

beforeEach(() => {
  config.clear();
  spies.sendToUser.mockClear();
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
    const message = err instanceof Error ? err.message : "Erreur";
    return reply.status(500).send({ message });
  });
  await app.register(async (scope) => {
    scope.addHook("preHandler", requireAuth);
    registerHintsRoutes(scope);
  }, { prefix: "/api/preferences" });
  return app;
}

const headers = { "x-emby-token": "jeton-banc" };

describe("GET/PUT /api/preferences/hints", () => {
  it("sans ligne : rien de masqué", async () => {
    const app = await makeApp();
    const response = await app.inject({ method: "GET", url: "/api/preferences/hints", headers });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ dismissed: [] });
    await app.close();
  });

  it("masquer puis réafficher : l'aller-retour, et la ligne disparaît quand plus rien n'est masqué", async () => {
    const app = await makeApp();
    const hidden = await app.inject({
      method: "PUT", url: "/api/preferences/hints/trailerHelp", headers, payload: { dismissed: true },
    });
    expect(hidden.statusCode).toBe(200);
    expect(hidden.json()).toEqual({ dismissed: ["trailerHelp"] });
    expect(config.get(hintsConfigKey("u1"))).toBe('["trailerHelp"]');
    expect((await app.inject({ method: "GET", url: "/api/preferences/hints", headers })).json())
      .toEqual({ dismissed: ["trailerHelp"] });

    // Masquer deux fois ne duplique rien.
    await app.inject({ method: "PUT", url: "/api/preferences/hints/trailerHelp", headers, payload: { dismissed: true } });
    expect(config.get(hintsConfigKey("u1"))).toBe('["trailerHelp"]');

    const shown = await app.inject({
      method: "PUT", url: "/api/preferences/hints/trailerHelp", headers, payload: { dismissed: false },
    });
    expect(shown.json()).toEqual({ dismissed: [] });
    expect(config.has(hintsConfigKey("u1"))).toBe(false);
    await app.close();
  });

  it("les autres appareils du compte sont prévenus, jamais l'auteur", async () => {
    const app = await makeApp();
    await app.inject({ method: "PUT", url: "/api/preferences/hints/trailerHelp", headers, payload: { dismissed: true } });
    expect(spies.sendToUser).toHaveBeenCalledTimes(1);
    expect(spies.sendToUser).toHaveBeenCalledWith(
      "u1",
      { type: "preferences:update", scope: "hints" },
      { exceptTokenHash: "jeton-banc" },
    );
    await app.close();
  });

  it("un rappel inconnu ou un corps invalide : 400, rien n'est écrit, personne n'est prévenu", async () => {
    const app = await makeApp();
    const unknown = await app.inject({
      method: "PUT", url: "/api/preferences/hints/popupPublicitaire", headers, payload: { dismissed: true },
    });
    expect(unknown.statusCode).toBe(400);
    const invalid = await app.inject({
      method: "PUT", url: "/api/preferences/hints/trailerHelp", headers, payload: { dismissed: "oui" },
    });
    expect(invalid.statusCode).toBe(400);
    expect(config.size).toBe(0);
    expect(spies.sendToUser).not.toHaveBeenCalled();
    await app.close();
  });

  it("une ligne illisible ou périmée vaut « rien de masqué », sans erreur", async () => {
    const app = await makeApp();
    config.set(hintsConfigKey("u1"), "{pas du json");
    expect((await app.inject({ method: "GET", url: "/api/preferences/hints", headers })).json()).toEqual({ dismissed: [] });
    // Un nom retiré du contrat ne ressuscite rien.
    config.set(hintsConfigKey("u1"), '["ancienRappel","trailerHelp"]');
    expect((await app.inject({ method: "GET", url: "/api/preferences/hints", headers })).json())
      .toEqual({ dismissed: ["trailerHelp"] });
    await app.close();
  });

  it("sans jeton : 401", async () => {
    const app = await makeApp();
    const response = await app.inject({ method: "GET", url: "/api/preferences/hints" });
    expect(response.statusCode).toBe(401);
    await app.close();
  });
});
