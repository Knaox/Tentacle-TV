/**
 * GET/PUT /api/preferences/still-watching : sans ligne, les défauts (activé) ;
 * un réglage enregistré se relit, borné ; les autres appareils du compte sont
 * prévenus ; un corps invalide est refusé sans rien écrire ; une ligne
 * illisible vaut les défauts. `server_config` en Map mémoire, auth réelle
 * contre un faux /Users/Me (motif preferences.hints.test.ts).
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
    },
  }),
}));

import { registerStillWatchingRoutes, stillWatchingConfigKey } from "./preferences.stillWatching";
import { DEFAULT_STILL_WATCHING_SETTINGS } from "../playback/stillWatchingSettings";
import { requireAuth } from "../middleware/auth";

beforeEach(() => {
  config.clear();
  spies.sendToUser.mockClear();
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
  await app.register(async (scope) => {
    scope.addHook("preHandler", requireAuth);
    registerStillWatchingRoutes(scope);
  }, { prefix: "/api/preferences" });
  return app;
}

const headers = { "x-emby-token": "jeton-banc" };
const url = "/api/preferences/still-watching";

describe("GET/PUT /api/preferences/still-watching", () => {
  it("sans ligne : les défauts, activé", async () => {
    const app = await makeApp();
    const response = await app.inject({ method: "GET", url, headers });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ stored: false, settings: DEFAULT_STILL_WATCHING_SETTINGS });
    await app.close();
  });

  it("enregistre, borne, relit, et prévient les autres appareils du compte", async () => {
    const app = await makeApp();
    const saved = await app.inject({ method: "PUT", url, headers, payload: { enabled: false, afterMs: 7_200_000, countdownMs: 999_999 } });
    expect(saved.statusCode).toBe(200);
    expect(saved.json()).toEqual({ stored: true, settings: { enabled: false, afterMs: 7_200_000, countdownMs: 120_000 } });
    expect(config.has(stillWatchingConfigKey("u1"))).toBe(true);
    expect((await app.inject({ method: "GET", url, headers })).json()).toEqual(saved.json());
    expect(spies.sendToUser).toHaveBeenCalledWith("u1", { type: "preferences:update", scope: "still-watching" }, { exceptTokenHash: "jeton-banc" });
    await app.close();
  });

  it("refuse un corps invalide sans rien écrire", async () => {
    const app = await makeApp();
    const response = await app.inject({ method: "PUT", url, headers, payload: { enabled: "oui" } });
    expect(response.statusCode).toBe(400);
    expect(config.size).toBe(0);
    await app.close();
  });

  it("une ligne illisible vaut les défauts", async () => {
    config.set(stillWatchingConfigKey("u1"), "{pas du json");
    const app = await makeApp();
    expect((await app.inject({ method: "GET", url, headers })).json()).toEqual({ stored: false, settings: DEFAULT_STILL_WATCHING_SETTINGS });
    await app.close();
  });
});
