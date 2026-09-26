/**
 * La route admin des métadonnées : lecture masquée, écriture validée auprès de
 * TMDB (clé refusée ≠ TMDB injoignable), test d'une clé sans l'enregistrer,
 * et refus d'un non-admin.
 */

import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const configStore = vi.hoisted(() => new Map<string, string>());
const kicks = vi.hoisted(() => [] as unknown[]);
vi.mock("../services/configStore", () => ({
  getJellyfinUrl: () => "http://jf.test",
  getConfigValue: (key: string) => configStore.get(key),
  setConfigValue: async (key: string, value: string) => {
    configStore.set(key, value);
  },
  deleteConfigValue: async (key: string) => {
    configStore.delete(key);
  },
}));
vi.mock("../services/jwt", () => ({
  verifyImpersonationToken: async () => null,
  verifyDeviceToken: async () => null,
  hashToken: (value: string) => value,
}));
vi.mock("../services/db", () => ({
  hasPrisma: () => false,
  getPrisma: () => {
    throw new Error("pas de prisma dans ce banc");
  },
}));
vi.mock("../services/tmdb/client", () => ({
  getTmdbApiKey: () => process.env.TMDB_API_KEY || configStore.get("tmdb_api_key") || undefined,
}));
vi.mock("../services/reco/fanout", () => ({
  fanoutStatus: () => ({ running: false, processed: 0, total: 0 }),
  kickRecoFanout: (opts: unknown) => {
    kicks.push(opts);
  },
}));
vi.mock("../services/reco/trendingRow", () => ({ refreshTrending: async () => undefined }));
vi.mock("../services/reco/crawlReseed", () => ({ requestCrawlerReseed: () => undefined }));

import { adminMetadataRoutes } from "./adminMetadata";

/** Clés TMDB du banc : l'une acceptée, l'autre refusée, la dernière sans réseau. */
const GOOD_KEY = "0123456789abcdef0123456789abcdef";
const BAD_KEY = "ffffffffffffffffffffffffffffffff";
const OFFLINE_KEY = "00000000000000000000000000000000";

beforeEach(() => {
  configStore.clear();
  kicks.length = 0;
  delete process.env.TMDB_API_KEY;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("https://api.themoviedb.org/3/configuration")) {
        const key = new URL(url).searchParams.get("api_key");
        if (key === GOOD_KEY) return Response.json({ images: {} });
        if (key === OFFLINE_KEY) throw new TypeError("fetch failed");
        return Response.json({ status_code: 7 }, { status: 401 });
      }
      const token = new Headers(init?.headers).get("x-emby-token");
      if (url.endsWith("/Users/Me")) {
        if (token === "tok-admin") return Response.json({ Id: "admin-1", Name: "Admin", Policy: { IsAdministrator: true } });
        if (token === "tok-user") return Response.json({ Id: "user-1", Name: "Banc", Policy: { IsAdministrator: false } });
        return new Response("{}", { status: 401 });
      }
      return new Response("{}", { status: 404 });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.TMDB_API_KEY;
});

async function call(method: "GET" | "PUT" | "POST", url: string, token: string, body?: unknown) {
  const app = Fastify();
  await app.register(adminMetadataRoutes, { prefix: "/api/admin" });
  const response = await app.inject({
    method,
    url: `/api/admin${url}`,
    headers: { "x-emby-token": token, "content-type": "application/json" },
    ...(body === undefined ? {} : { payload: JSON.stringify(body) }),
  });
  await app.close();
  return response;
}

describe("GET /api/admin/metadata", () => {
  it("masque la clé : configurée, sa source et ses quatre derniers caractères", async () => {
    configStore.set("tmdb_api_key", GOOD_KEY);
    const response = await call("GET", "/metadata", "tok-admin");
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      tmdb: { configured: true, source: "db", last4: "cdef" },
      watchRegion: "FR",
    });
    expect(response.body).not.toContain(GOOD_KEY);
  });

  it("refuse un compte qui n'est pas administrateur", async () => {
    const response = await call("GET", "/metadata", "tok-user");
    expect(response.statusCode).toBe(403);
  });
});

describe("PUT /api/admin/metadata", () => {
  it("enregistre une clé acceptée par TMDB et lance le calcul des recommandations", async () => {
    const response = await call("PUT", "/metadata", "tok-admin", { tmdbApiKey: ` ${GOOD_KEY} ` });
    expect(response.statusCode).toBe(200);
    expect(configStore.get("tmdb_api_key")).toBe(GOOD_KEY);
    expect(kicks).toEqual([{ force: true, reason: "key-set" }]);
  });

  it("refuse une clé que TMDB rejette, sans rien écrire", async () => {
    const response = await call("PUT", "/metadata", "tok-admin", { tmdbApiKey: BAD_KEY });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "tmdb-key-invalid" });
    expect(configStore.has("tmdb_api_key")).toBe(false);
  });

  it("dit que TMDB est injoignable plutôt que la clé fausse, sans rien écrire", async () => {
    const response = await call("PUT", "/metadata", "tok-admin", { tmdbApiKey: OFFLINE_KEY });
    expect(response.statusCode).toBe(502);
    expect(response.json()).toEqual({ error: "tmdb-unreachable" });
    expect(configStore.has("tmdb_api_key")).toBe(false);
  });

  it("une chaîne vide retire la clé, et la région s'écrit seule", async () => {
    configStore.set("tmdb_api_key", GOOD_KEY);
    const response = await call("PUT", "/metadata", "tok-admin", { tmdbApiKey: "", watchRegion: "BE" });
    expect(response.statusCode).toBe(200);
    expect(configStore.has("tmdb_api_key")).toBe(false);
    expect(configStore.get("tmdb_watch_region")).toBe("BE");
    expect(kicks).toEqual([]);
  });
});

describe("POST /api/admin/metadata/tmdb/test", () => {
  it("teste une clé saisie sans l'enregistrer", async () => {
    const valid = await call("POST", "/metadata/tmdb/test", "tok-admin", { tmdbApiKey: GOOD_KEY });
    expect(valid.json()).toEqual({ result: "valid" });
    const invalid = await call("POST", "/metadata/tmdb/test", "tok-admin", { tmdbApiKey: BAD_KEY });
    expect(invalid.json()).toEqual({ result: "invalid" });
    const offline = await call("POST", "/metadata/tmdb/test", "tok-admin", { tmdbApiKey: OFFLINE_KEY });
    expect(offline.json()).toEqual({ result: "unreachable" });
    expect(configStore.has("tmdb_api_key")).toBe(false);
  });

  it("sans clé saisie, teste la clé effective — variable d'environnement comprise", async () => {
    configStore.set("tmdb_api_key", BAD_KEY);
    process.env.TMDB_API_KEY = GOOD_KEY;
    const response = await call("POST", "/metadata/tmdb/test", "tok-admin", {});
    expect(response.json()).toEqual({ result: "valid" });
  });

  it("sans aucune clé, le dit au lieu d'interroger TMDB", async () => {
    const response = await call("POST", "/metadata/tmdb/test", "tok-admin", {});
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "tmdb-key-missing" });
  });

  it("refuse un compte qui n'est pas administrateur", async () => {
    const response = await call("POST", "/metadata/tmdb/test", "tok-user", { tmdbApiKey: GOOD_KEY });
    expect(response.statusCode).toBe(403);
  });
});
