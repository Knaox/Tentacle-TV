/**
 * Les routes de la page admin « Services » : l'état sondé de Jellyfin et de la
 * base, l'essai et l'enregistrement de Jellyfin sans retaper la clé, et les
 * échecs qui portent un code traduisible.
 */

import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Probe = { ok: true; version: string } | { ok: false };

const state = vi.hoisted(() => ({
  config: new Map<string, string>(),
  db: {
    configured: null as string | null,
    active: null as string | null,
    source: null as "env" | "file" | null,
    probe: { ok: false } as Probe,
  },
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
  getDatabaseUrl: () => state.db.configured,
  getActiveDatabaseUrl: () => state.db.active,
  getDatabaseUrlSource: () => state.db.source,
  probeDatabase: async () => state.db.probe,
  saveDatabaseUrl: (url: string) => {
    state.db.configured = url;
  },
}));
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

const ACTIVE_DB = "mysql://tentacle:secret@db:3306/tentacle";

/** Un Jellyfin simulé : « bonne-cle » acceptée ; down.test muet ; html.test n'est pas un Jellyfin. */
const jellyfin = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  if (url.startsWith("http://down.test")) throw new TypeError("fetch failed");
  if (url.startsWith("http://html.test")) return new Response("<html></html>", { status: 200 });
  if (new Headers(init?.headers).get("x-emby-token") !== "bonne-cle") return new Response("", { status: 401 });
  return Response.json({ Version: "10.10.7", ServerName: "Poulpy" });
});

beforeEach(() => {
  state.config.clear();
  state.db = { configured: ACTIVE_DB, active: ACTIVE_DB, source: "file", probe: { ok: true, version: "11.4.4-MariaDB" } };
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
const lastKeySent = () => new Headers(jellyfin.mock.calls.at(-1)?.[1]?.headers).get("x-emby-token");

describe("GET /services", () => {
  it("sonde Jellyfin et la base : versions, nom du serveur, clé présente, origine de la connexion", async () => {
    state.config.set("jellyfin_url", "http://jf.test");
    state.config.set("jellyfin_api_key", "bonne-cle");
    const { status, body } = await call("GET", "/services");
    expect(status).toBe(200);
    expect(body.jellyfin).toEqual({
      url: "http://jf.test", apiKeyConfigured: true, status: "connected", version: "10.10.7", serverName: "Poulpy",
    });
    expect(body.database).toEqual({
      status: "connected", version: "11.4.4-MariaDB", source: "file", fromEnv: false, pendingRestart: false,
      fields: { host: "db", port: 3306, database: "tentacle", user: "tentacle" },
    });
  });

  it("dit la clé refusée, et une base qui ne répond plus", async () => {
    state.config.set("jellyfin_url", "http://jf.test");
    state.config.set("jellyfin_api_key", "cle-revoquee");
    state.db.probe = { ok: false };
    const { body } = await call("GET", "/services");
    expect(body.jellyfin).toMatchObject({ status: "error", error: "jellyfin-rejected", httpStatus: 401 });
    expect(body.database.status).toBe("error");
    expect(body.database.version).toBe("");
  });

  it("sans clé enregistrée, ne sonde rien et le dit", async () => {
    state.config.set("jellyfin_url", "http://jf.test");
    const { body } = await call("GET", "/services");
    expect(body.jellyfin).toMatchObject({ status: "disconnected", apiKeyConfigured: false });
    expect(jellyfin).not.toHaveBeenCalled();
  });

  it("décrit la connexion OUVERTE et signale celle qui attend le redémarrage", async () => {
    state.db.configured = "mysql://autre:pass@nas:3307/tentacle2";
    state.db.source = "env";
    const { body } = await call("GET", "/services");
    expect(body.database).toMatchObject({ pendingRestart: true, source: "env", fromEnv: true });
    expect(body.database.fields.host).toBe("db");
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
  it("enregistre l'URL, identifiants encodés", async () => {
    const payload = { host: "nas", port: 3307, database: "tentacle", user: "ad@min", password: "p@ss:w/rd" };
    const { status } = await call("PUT", "/database", payload);
    expect(status).toBe(200);
    expect(state.db.configured).toBe("mysql://ad%40min:p%40ss%3Aw%2Frd@nas:3307/tentacle");
  });

  it("refuse un corps incomplet avec un code", async () => {
    const { status, body } = await call("PUT", "/database", { host: "nas" });
    expect(status).toBe(400);
    expect(body.error).toBe("invalid-body");
  });
});
