/**
 * `GET /api/trailers/catalog` de bout en bout, sans réseau : Jellyfin, TMDB,
 * la recherche Dailymotion (réponse réelle figée d'AlloCiné) et la mémoire
 * globale sont factices ; l'auth est réduite à « un jeton ». La langue du
 * serveur est celle des métadonnées de Jellyfin (`setTitleLanguage`).
 */

import { readFileSync } from "fs";
import { join } from "path";
import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { jellyfinAdminFetch, tmdbFetch, config, rows } = vi.hoisted(() => ({
  jellyfinAdminFetch: vi.fn(),
  tmdbFetch: vi.fn(),
  config: new Map<string, string>(),
  rows: new Map<string, { payload: unknown; generatedAt: Date; expiresAt: Date }>(),
}));
vi.mock("../services/jellyfinAdminFetch", () => ({ jellyfinAdminFetch }));
vi.mock("../services/configStore", () => ({
  getConfigValue: (key: string) => config.get(key),
  setConfigValue: async (key: string, value: string) => void config.set(key, value),
  deleteConfigValue: async (key: string) => void config.delete(key),
}));
vi.mock("../services/globalCacheStore", () => ({
  readGlobalCache: async (key: string) => rows.get(key) ?? null,
  writeGlobalCache: async (key: string, payload: unknown, ttlMs: number) =>
    void rows.set(key, { payload, generatedAt: new Date(), expiresAt: new Date(Date.now() + ttlMs) }),
}));
vi.mock("../services/tmdb/client", () => {
  class TmdbError extends Error {
    constructor(message: string, readonly status: number) {
      super(message);
    }
  }
  return { TmdbError, tmdbFetch: (...args: unknown[]) => tmdbFetch(...args), tmdbConfigured: () => true };
});
vi.mock("../services/seerConfig", () => ({ getSeerrConfig: () => null }));
vi.mock("../middleware/auth", () => ({
  requireAuth: async (request: { headers: Record<string, unknown>; user?: unknown }, reply: { status: (c: number) => { send: (b: unknown) => unknown } }) => {
    const token = String(request.headers.authorization ?? "").replace(/^Bearer /, "");
    if (!token) return reply.status(401).send({ message: "Unauthorized" });
    request.user = { userId: token.padEnd(32, "0").slice(0, 32), username: token, isAdmin: false, session: "personal" };
  },
}));

import { setTitleLanguage } from "../services/reco/titleLanguage";
import { resetAllocineSearches } from "../services/trailers/allocine/allocineSearch";
import { resetCatalogMemory } from "../services/trailers/catalog/catalogMemory";
import { resetCatalogTitles } from "../services/trailers/catalog/catalogTitle";
import { resetDailymotionGuard } from "../services/trailers/dailymotionGuard";
import { readTrailerCatalog } from "../trailers/trailerCatalog";
import { resetCatalogLimiter, trailerCatalogRoutes } from "./trailerCatalog";

const SERIES = "11111111111111111111111111111111";
const EP_S7 = "22222222222222222222222222222222";
const EP_S9 = "33333333333333333333333333333333";
const MOVIE = "44444444444444444444444444444444";
const SEASONS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const AIRED: Record<number, string> = {
  1: "2013-12-02", 2: "2015-07-26", 3: "2017-04-01", 4: "2019-11-10", 5: "2021-06-20", 6: "2022-09-04", 7: "2023-10-15", 8: "2025-05-25", 9: "2026-05-24",
};
const RICK_PAGE = readFileSync(join(__dirname, "../services/trailers/allocine/fixtures/rick-et-morty.json"), "utf8");

function jellyfin(path: string) {
  const id = /^\/(?:Items|Shows)\/(\w+)/.exec(path)?.[1];
  if (path.startsWith(`/Shows/${SERIES}/Seasons`)) {
    return { ok: true, data: { Items: SEASONS.map((n) => ({ Id: `${n}`.repeat(32).slice(0, 32), IndexNumber: n, PremiereDate: `${AIRED[n]}T00:00:00Z` })) } };
  }
  if (id === SERIES) {
    return { ok: true, data: { Id: SERIES, Type: "Series", Name: "Rick et Morty", OriginalTitle: "Rick and Morty", PremiereDate: "2013-12-02T00:00:00Z", Status: "Continuing", ProviderIds: { Tmdb: "60625" }, RemoteTrailers: [] } };
  }
  if (id === EP_S7) return { ok: true, data: { Id: EP_S7, Type: "Episode", SeriesId: SERIES, ParentIndexNumber: 7 } };
  if (id === EP_S9) return { ok: true, data: { Id: EP_S9, Type: "Episode", SeriesId: SERIES, ParentIndexNumber: 9 } };
  if (id === MOVIE) {
    return { ok: true, data: { Id: MOVIE, Type: "Movie", Name: "Arrival", ProviderIds: { Tmdb: "329865" }, RemoteTrailers: [{ Url: "https://www.youtube.com/watch?v=jellyfinAAA", Name: "Trailer" }] } };
  }
  return { ok: false, failure: "invalid", status: 404 };
}

function tmdb(path: string) {
  if (path === "/tv/60625") {
    return {
      name: "Rick et Morty", original_name: "Rick and Morty", original_language: "en", first_air_date: "2013-12-02", in_production: true,
      seasons: SEASONS.map((n) => ({ season_number: n, air_date: AIRED[n] })),
      videos: { results: [{ key: "promosS1aaa", site: "YouTube", type: "Trailer", name: "Season 1 Promos", iso_639_1: "en" }] },
    };
  }
  const season = /^\/tv\/60625\/season\/(\d+)\/videos$/.exec(path)?.[1];
  if (season === "8") return { results: [{ key: "season8enen", site: "YouTube", type: "Trailer", name: "Season 8 Official Trailer", iso_639_1: "en" }] };
  if (season) return { results: [] };
  if (path === "/movie/329865") {
    return {
      title: "Premier Contact", original_title: "Arrival", original_language: "en", release_date: "2016-11-10",
      videos: { results: [
        { key: "arrivalEnEn", site: "YouTube", type: "Trailer", name: "Official Trailer", iso_639_1: "en" },
        { key: "arrivalVfVf", site: "YouTube", type: "Trailer", name: "Bande-annonce VF", iso_639_1: "fr" },
      ] },
    };
  }
  throw new Error(`TMDB inattendu : ${path}`);
}

const dailymotion = vi.fn(async () => new Response(RICK_PAGE, { status: 200 }));

async function server() {
  const app = Fastify();
  await app.register(trailerCatalogRoutes, { prefix: "/api/trailers" });
  return app;
}

async function catalog(query: string, token = "alice") {
  const app = await server();
  const res = await app.inject({ url: `/api/trailers/catalog?${query}`, headers: token ? { authorization: `Bearer ${token}` } : {} });
  return { res, body: res.statusCode === 200 ? readTrailerCatalog(res.json()) : null };
}

const firstPlayback = (body: ReturnType<typeof readTrailerCatalog>) => body?.entries[0]?.playback;

beforeEach(() => {
  config.clear();
  rows.clear();
  resetAllocineSearches();
  resetCatalogMemory();
  resetCatalogTitles();
  resetDailymotionGuard();
  resetCatalogLimiter();
  setTitleLanguage("fr-FR");
  jellyfinAdminFetch.mockReset().mockImplementation(async (path: string) => jellyfin(path));
  tmdbFetch.mockReset().mockImplementation(async (path: string) => tmdb(path));
  dailymotion.mockClear();
  vi.stubGlobal("fetch", dailymotion);
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

describe("GET /api/trailers/catalog", () => {
  it("Rick et Morty, un épisode de S7 : la VF AlloCiné de S6 en tête, la liste ordonnée par portée", async () => {
    const { res, body } = await catalog(`itemId=${EP_S7}&lang=en`);
    expect(res.statusCode).toBe(200);
    expect(res.headers["cache-control"]).toBe("private, max-age=60");
    expect(body?.language).toBe("fr");
    expect(body?.complete).toBe(true);
    expect(firstPlayback(body)).toEqual({ kind: "dailymotion", videoId: "x8e90ff" });
    expect(body?.entries[0]).toMatchObject({ scope: { kind: "season", season: 6 }, version: "localized", source: "allocine" });
    // S6, S5, S4, S3, puis la série, puis S8 et S9 (elles divulgâchent) : huit au plus.
    expect(body?.entries.map((e) => (e.scope.kind === "season" ? e.scope.season : e.scope.kind))).toEqual([6, 5, 5, 4, 4, 3, "series", 8]);
  });

  it("Rick et Morty, un épisode de S9 : la VO STFR de S9 en tête", async () => {
    const { body } = await catalog(`itemId=${EP_S9}`);
    expect(firstPlayback(body)).toEqual({ kind: "dailymotion", videoId: "xa9l1fq" });
    expect(body?.entries[0].version).toBe("subtitled");
  });

  it("une recherche AlloCiné et une lecture TMDB servent tous les épisodes et tous les comptes", async () => {
    await catalog(`itemId=${EP_S7}`, "alice");
    const tmdbCalls = tmdbFetch.mock.calls.length;
    await catalog(`itemId=${EP_S9}`, "bob");
    expect(dailymotion).toHaveBeenCalledTimes(1);
    // S9 demande des saisons que S7 n'avait pas lues (S9, S8…) ; la série, jamais deux fois.
    expect(tmdbFetch.mock.calls.filter(([path]) => path === "/tv/60625")).toHaveLength(1);
    expect(tmdbFetch.mock.calls.length).toBeGreaterThan(tmdbCalls);
  });

  it("un serveur anglais : AlloCiné n'est pas consulté, l'anglais d'abord", async () => {
    setTitleLanguage("en");
    const { body } = await catalog(`itemId=${MOVIE}&lang=fr`);
    expect(dailymotion).not.toHaveBeenCalled();
    expect(body?.language).toBe("en");
    expect(firstPlayback(body)).toEqual({ kind: "youtube", ytId: "arrivalEnEn" });
  });

  it("un film, serveur français : la VF de TMDB d'abord, puis la VO, puis celle de Jellyfin", async () => {
    dailymotion.mockResolvedValueOnce(new Response(JSON.stringify({ list: [], has_more: false })));
    const { body } = await catalog(`itemId=${MOVIE}`);
    expect(body?.entries.map((e) => [e.source, e.version, e.playback.kind === "youtube" ? e.playback.ytId : ""])).toEqual([
      ["tmdb", "localized", "arrivalVfVf"], ["tmdb", "original", "arrivalEnEn"], ["jellyfin", "unknown", "jellyfinAAA"],
    ]);
  });

  it("AlloCiné décoché par l'administrateur : il n'est plus consulté", async () => {
    config.set("trailers_allocine_enabled", "false");
    const { body } = await catalog(`itemId=${EP_S7}`);
    expect(dailymotion).not.toHaveBeenCalled();
    expect(body?.entries.every((e) => e.source !== "allocine")).toBe(true);
  });

  it("hors bibliothèque (Vigie) : un titre TMDB et une saison", async () => {
    const { body } = await catalog("tmdbId=60625&mediaType=tv&season=7");
    expect(firstPlayback(body)).toEqual({ kind: "dailymotion", videoId: "x8e90ff" });
    expect(jellyfinAdminFetch).not.toHaveBeenCalled();
  });

  it("un titre que ce compte ne voit pas : une liste vide, complète ; une demande illisible : 400", async () => {
    const { body } = await catalog("itemId=99999999999999999999999999999999");
    expect(body).toEqual({ entries: [], complete: true, language: "fr" });
    expect((await catalog("itemId=../etc")).res.statusCode).toBe(400);
    expect((await catalog(`itemId=${MOVIE}`, "")).res.statusCode).toBe(401);
  });

  it("au bout de 3 s, ce qu'il y a — le reste arrive à la demande suivante", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    try {
      dailymotion.mockImplementationOnce(() => new Promise((resolve) => setTimeout(() => resolve(new Response(RICK_PAGE)), 10_000)));
      const pending = catalog(`itemId=${EP_S7}`);
      await vi.advanceTimersByTimeAsync(3_100);
      const { body } = await pending;
      expect(body?.complete).toBe(false);
      expect(body?.entries.every((e) => e.source !== "allocine")).toBe(true);
      await vi.advanceTimersByTimeAsync(10_000);
      vi.useRealTimers();
      const again = await catalog(`itemId=${EP_S7}`);
      expect(firstPlayback(again.body)).toEqual({ kind: "dailymotion", videoId: "x8e90ff" });
    } finally {
      vi.useRealTimers();
    }
  });

  it("trop de demandes d'un compte : 429 avec Retry-After", async () => {
    const app = await server();
    let last = 0;
    for (let i = 0; i < 31; i++) {
      last = (await app.inject({ url: "/api/trailers/catalog?itemId=99999999999999999999999999999999", headers: { authorization: "Bearer carol" } })).statusCode;
    }
    expect(last).toBe(429);
  });
});
