/**
 * Le streaming direct n'est confié à un client que s'il sait parler au
 * Jellyfin connecté : un client d'avant Jellyfin 12 (X-Emby-Token, api_key)
 * reste sur le proxy quand Jellyfin refuse l'authentification héritée.
 */
import Fastify from "fastify";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ legacyAccepted: true }));

vi.mock("../services/configStore", () => ({
  getDirectStreamingConfig: () => ({ enabled: true, publicUrl: "https://media.example", privateUrl: "http://192.168.1.2:8096" }),
  getJellyfinUrl: () => "http://jellyfin.test",
  getPublicUrl: () => null,
}));
vi.mock("../services/jellyfinSystemConfig", () => ({ getMaxResumePct: async () => 90 }));
vi.mock("../middleware/auth", () => ({ requireAuth: async () => {} }));
vi.mock("../services/jwt", () => ({ verifyDeviceToken: async () => null }));
vi.mock("../services/deviceTokenHealth", () => ({ resolvePairedDeviceToken: async () => ({ token: null, purged: false }) }));
vi.mock("../services/deviceSessions/deviceAuth", () => ({ pairedJellyfinDeviceId: async () => null }));
vi.mock("../services/jellyfinLegacyAuth", () => ({ jellyfinAcceptsLegacyAuth: async () => state.legacyAccepted }));

import { configRoutes } from "./config";

const app = Fastify();
beforeAll(async () => {
  await app.register(configRoutes, { prefix: "/api" });
});

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
});
afterEach(() => {
  vi.unstubAllGlobals();
  state.legacyAccepted = true;
});

async function streaming(query = ""): Promise<{ enabled: boolean }> {
  const res = await app.inject({ method: "GET", url: `/api/config/streaming${query}`, headers: { authorization: "Bearer jeton-jellyfin" } });
  return (res.json() as { directStreaming: { enabled: boolean } }).directStreaming;
}

describe("GET /api/config/streaming", () => {
  it("Jellyfin qui accepte l'auth héritée : le direct pour tous les clients", async () => {
    expect((await streaming()).enabled).toBe(true);
    expect((await streaming("?jellyfinAuth=modern")).enabled).toBe(true);
  });

  it("Jellyfin qui la refuse (12.x) : le client ancien reste sur le proxy, le client à jour garde le direct", async () => {
    state.legacyAccepted = false;
    expect((await streaming()).enabled).toBe(false);
    expect((await streaming("?jellyfinAuth=modern")).enabled).toBe(true);
  });
});
