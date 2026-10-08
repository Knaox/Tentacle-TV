/**
 * Les routes de la page admin « Services » : l'état sondé de Jellyfin et de la
 * base SQLite, l'essai et l'enregistrement de Jellyfin sans retaper la clé, et les
 * échecs qui portent un code traduisible.
 */

import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { modernJellyfinToken } from "../../test/jellyfinFakeAuth";

const state = vi.hoisted(() => ({
  config: new Map<string, string>(),
  db: {} as Record<string, unknown>,
  restarts: 0,
  invalidations: 0,
}));

vi.mock("../services/configStore", () => ({
  getJellyfinUrl: () => state.config.get("jellyfin_url"),
  getJellyfinApiKey: () => state.config.get("jellyfin_api_key"),
  setConfigValue: async (key: string, value: string) => {
    state.config.set(key, value);
  },
  setAppState: () => undefined,
}));
vi.mock("../services/db", () => ({
  getPrisma: () => {
    throw new Error("pas de prisma dans ce banc");
  },
}));
// La carte de la base est éprouvée sur une vraie base (test/sqlite/databaseStatus.test.ts).
vi.mock("../services/database/databaseStatus", () => ({ databaseStatus: async () => state.db }));
vi.mock("../services/jellyfinWs", () => ({
  restartJellyfinWs: () => {
    state.restarts += 1;
  },
}));
vi.mock("../services/jellyfinKeyHealth", () => ({
  invalidateAdminKeyHealth: () => {
    state.invalidations += 1;
  },
}));

import { adminServicesRoutes } from "./adminServices";

const SQLITE_STATUS = {
  status: "connected", version: "3.46.0", engine: "sqlite", path: "/data/tentacle.db", sizeBytes: 4096, storage: "local",
  source: "env", fromEnv: true, pendingRestart: false,
};

/** Un Jellyfin simulé : « bonne-cle » acceptée ; down.test muet ; html.test n'est pas un Jellyfin. */
const jellyfin = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  if (url.startsWith("http://down.test")) throw new TypeError("fetch failed");
  if (url.startsWith("http://html.test")) return new Response("<html></html>", { status: 200 });
  // Jellyfin 10.11 pendant son démarrage (mesuré) : 503 « loading », quelle que soit la clé.
  if (url.startsWith("http://loading.test")) return new Response("Jellyfin Server is loading. Please try again shortly.", { status: 503 });
  if (modernJellyfinToken(init?.headers) !== "bonne-cle") return new Response("", { status: 401 });
  return Response.json({ Version: "10.10.7", ServerName: "Poulpy" });
});

beforeEach(() => {
  state.config.clear();
  state.db = { ...SQLITE_STATUS };
  state.restarts = 0;
  state.invalidations = 0;
  jellyfin.mockClear();
  vi.stubGlobal("fetch", jellyfin);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function call(method: "GET" | "POST" | "PUT", url: string, payload?: object) {
  const app = Fastify();
  await app.register(adminServicesRoutes, { prefix: "/api/admin" });
  const res = await app.inject({ method, url: `/api/admin${url}`, ...(payload ? { payload } : {}) });
  await app.close();
  return { status: res.statusCode, body: res.json() };
}

/** La clé que le serveur a présentée à Jellyfin, au dernier appel. */
const lastKeySent = () => modernJellyfinToken(jellyfin.mock.calls.at(-1)?.[1]?.headers);

describe("GET /services", () => {
  it("sonde Jellyfin et la base : versions, nom du serveur, clé présente, fichier de la base", async () => {
    state.config.set("jellyfin_url", "http://jf.test");
    state.config.set("jellyfin_api_key", "bonne-cle");
    const { status, body } = await call("GET", "/services");
    expect(status).toBe(200);
    expect(body.jellyfin).toEqual({
      url: "http://jf.test", apiKeyConfigured: true, status: "connected", version: "10.10.7", serverName: "Poulpy",
    });
    expect(body.database).toEqual(SQLITE_STATUS);
  });

  it("dit la clé refusée, et une base qui ne répond plus", async () => {
    state.config.set("jellyfin_url", "http://jf.test");
    state.config.set("jellyfin_api_key", "cle-revoquee");
    state.db = { ...SQLITE_STATUS, status: "error", version: "" };
    const { body } = await call("GET", "/services");
    expect(body.jellyfin).toMatchObject({ status: "error", error: "jellyfin-rejected", httpStatus: 401 });
    expect(body.database.status).toBe("error");
  });

  it("Jellyfin qui démarre (503) : injoignable, jamais « clé refusée »", async () => {
    state.config.set("jellyfin_url", "http://loading.test");
    state.config.set("jellyfin_api_key", "bonne-cle");
    const { body } = await call("GET", "/services");
    expect(body.jellyfin).toMatchObject({ status: "error", error: "jellyfin-unreachable" });
    expect(body.jellyfin.httpStatus).toBeUndefined();
    expect(body.jellyfin.health).toMatchObject({ state: expect.any(String), since: expect.any(Number) });
  });

  it("sans clé enregistrée, ne sonde rien et le dit", async () => {
    state.config.set("jellyfin_url", "http://jf.test");
    const { body } = await call("GET", "/services");
    expect(body.jellyfin).toMatchObject({ status: "disconnected", apiKeyConfigured: false });
    expect(jellyfin).not.toHaveBeenCalled();
  });
});

describe("POST /test-jellyfin", () => {
  it("essaie la clé enregistrée quand aucune n'est saisie", async () => {
    state.config.set("jellyfin_api_key", "bonne-cle");
    const { status, body } = await call("POST", "/test-jellyfin", { url: "http://jf.test/" });
    expect(status).toBe(200);
    expect(body).toEqual({ success: true, version: "10.10.7", serverName: "Poulpy" });
    expect(jellyfin.mock.calls.at(-1)?.[0]).toBe("http://jf.test/System/Info");
    expect(lastKeySent()).toBe("bonne-cle");
  });

  it("préfère la clé saisie", async () => {
    state.config.set("jellyfin_api_key", "ancienne-cle");
    await call("POST", "/test-jellyfin", { url: "http://jf.test", apiKey: " bonne-cle " });
    expect(lastKeySent()).toBe("bonne-cle");
  });

  it("rend un code par échec : clé absente, hôte muet, pas un Jellyfin, clé refusée, requête illisible", async () => {
    expect((await call("POST", "/test-jellyfin", { url: "http://jf.test" })).body.error).toBe("jellyfin-key-missing");
    state.config.set("jellyfin_api_key", "bonne-cle");
    expect((await call("POST", "/test-jellyfin", { url: "http://down.test" })).body.error).toBe("jellyfin-unreachable");
    expect((await call("POST", "/test-jellyfin", { url: "http://html.test" })).body.error).toBe("jellyfin-invalid");
    const rejected = await call("POST", "/test-jellyfin", { url: "http://jf.test", apiKey: "mauvaise" });
    expect(rejected).toMatchObject({ status: 400, body: { error: "jellyfin-rejected", httpStatus: 401, message: "Jellyfin a répondu 401" } });
    expect((await call("POST", "/test-jellyfin", { url: "pas une url" })).body.error).toBe("invalid-body");
  });
});

describe("PUT /jellyfin", () => {
  it("change l'URL en gardant la clé enregistrée, et relance ce qui en dépend", async () => {
    state.config.set("jellyfin_url", "http://ancien.test");
    state.config.set("jellyfin_api_key", "bonne-cle");
    const { status, body } = await call("PUT", "/jellyfin", { url: "http://jf.test/", apiKey: "" });
    expect(status).toBe(200);
    expect(body).toEqual({ success: true, version: "10.10.7", serverName: "Poulpy" });
    expect(state.config.get("jellyfin_url")).toBe("http://jf.test");
    expect(state.config.get("jellyfin_api_key")).toBe("bonne-cle");
    expect(state.restarts).toBe(1);
    expect(state.invalidations).toBe(1);
  });

  it("enregistre une clé saisie", async () => {
    state.config.set("jellyfin_api_key", "ancienne-cle");
    await call("PUT", "/jellyfin", { url: "http://jf.test", apiKey: "bonne-cle" });
    expect(state.config.get("jellyfin_api_key")).toBe("bonne-cle");
  });

  it("n'enregistre rien quand Jellyfin refuse", async () => {
    state.config.set("jellyfin_url", "http://ancien.test");
    const { status, body } = await call("PUT", "/jellyfin", { url: "http://jf.test", apiKey: "mauvaise" });
    expect(status).toBe(400);
    expect(body.error).toBe("jellyfin-rejected");
    expect(state.config.get("jellyfin_url")).toBe("http://ancien.test");
    expect(state.config.has("jellyfin_api_key")).toBe(false);
    expect(state.restarts).toBe(0);
  });
});

describe("PUT /database", () => {
  it("SQLite n'a rien à configurer : un refus que l'admin d'avant 1.25 affiche tel quel", async () => {
    const payload = { host: "nas", port: 3307, database: "tentacle", user: "admin", password: "secret" };
    const { status, body } = await call("PUT", "/database", payload);
    expect(status).toBe(400);
    expect(body).toEqual({ error: "database-managed", message: "La base est intégrée au serveur (SQLite) : rien à configurer." });
  });
});
