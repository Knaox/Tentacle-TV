/**
 * La route /api/stats/me de bout en bout : auth réelle (Jellyfin bouchonné
 * par le fetch global, motif watchlist.test.ts), base en mémoire, fiches TMDB
 * en cache. Deux films (l'un vu avant la première mesure, l'autre mesuré), un
 * animé suivi, un profil de goût : ce qu'un vrai compte ressemble.
 */

import Fastify from "fastify";
import { ZodError } from "zod";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ViewingStats } from "../services/viewingStats/contract";

const NOW = Date.parse("2026-09-28T12:00:00Z");
const EPOCH = new Date("2026-08-05T00:00:00Z");
const TICKS = 10_000_000;
const state = { jellyfinUrl: "http://jf.test" as string | null, itemsFail: false };
const calls: string[] = [];

vi.mock("../services/configStore", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../services/configStore")>()),
  getJellyfinUrl: () => state.jellyfinUrl,
  getJellyfinApiKey: () => "cle-admin",
}));
vi.mock("../services/jwt", () => ({
  verifyImpersonationToken: async () => null,
  verifyDeviceToken: async () => null,
  hashToken: (value: string) => value,
}));

const tmdb = (mediaType: string, tmdbId: number, raw: Record<string, unknown>) => ({
  mediaType, tmdbId, payload: JSON.stringify({ id: tmdbId, ...raw }), expiresAt: new Date(NOW + 86_400_000),
});
const META = [
  tmdb("movie", 603, {
    title: "The Matrix", genres: [{ id: 28, name: "Action" }, { id: 878, name: "SF" }], original_language: "en", origin_country: ["US"],
    release_date: "1999-03-31", poster_path: "/matrix.jpg",
    credits: { cast: [{ id: 6384, name: "Keanu Reeves", order: 0, profile_path: "/keanu.jpg" }],
      crew: [{ id: 9340, name: "Lana Wachowski", job: "Director", profile_path: "/lana.jpg" }] },
  }),
  tmdb("movie", 438631, {
    title: "Dune", genres: [{ id: 878, name: "SF" }, { id: 12, name: "Aventure" }], original_language: "en", origin_country: ["US", "CA"],
    credits: { cast: [{ id: 1190668, name: "Timothée Chalamet", order: 0, profile_path: "/tc.jpg" }],
      crew: [{ id: 137427, name: "Denis Villeneuve", job: "Director" }] },
  }),
  tmdb("tv", 1399, { name: "Game of Thrones", poster_path: "/got.jpg", origin_country: ["US"] }),
  tmdb("tv", 209867, {
    name: "Frieren", genres: [{ id: 16, name: "Animation" }, { id: 10765, name: "SF & F" }], original_language: "ja",
    origin_country: ["JP"], credits: { cast: [{ id: 1, name: "Atsumi Tanezaki", order: 0 }] },
  }),
];

const seg = (itemId: string, itemType: string, start: string, seconds: number, extra: Record<string, unknown>) => ({
  itemId, itemType, itemName: itemId, seriesId: null, seriesName: null, runtimeSeconds: null,
  seconds, startedAt: new Date(start), lastSeenAt: new Date(Date.parse(start) + seconds * 1000), ...extra,
});
// Matrix en VF, Frieren en VO japonaise — la piste que le collecteur a relevée.
const SEGMENTS = [
  seg("m2", "Movie", "2026-09-20T19:45:00Z", 7200, { itemName: "Matrix", clientName: "Tentacle TV - Mobile", runtimeSeconds: 8160, audioLang: "fr" }),
  seg("e1", "Episode", "2026-09-26T20:05:00Z", 1440, { seriesId: "s1", seriesName: "Frieren", clientName: "Tentacle TV - TV", audioLang: "ja" }),
  seg("e2", "Episode", "2026-09-26T20:32:00Z", 1440, { seriesId: "s1", seriesName: "Frieren", clientName: "Tentacle TV - TV", audioLang: "ja" }),
];

// Ma liste seule : Inception (en bibliothèque) et Game of Thrones (pas encore arrivé) — des potentiels.
const POTENTIALS = [
  { key: "movie:27205", mediaType: "movie", tmdbId: 27205, title: "Inception", jellyfinId: "m9" },
  { key: "tv:1399", mediaType: "tv", tmdbId: 1399, title: "", jellyfinId: null },
];

const ANCHORS = [
  { key: "movie:603", mediaType: "movie", tmdbId: 603, title: "", weight: 1.6, consumption: true, hours: 2, lastAt: null, kinds: ["rating", "completed"] },
  { key: "tv:209867", mediaType: "tv", tmdbId: 209867, title: "Frieren", weight: 0.9, consumption: true, hours: 0.8, lastAt: null, kinds: ["series"] },
  { key: "movie:999", mediaType: "movie", tmdbId: 999, title: "Envie", weight: 0.3, consumption: false, hours: 0, lastAt: null, kinds: ["watchlist"] },
  { key: "movie:13", mediaType: "movie", tmdbId: 13, title: "Non", weight: -0.6, consumption: false, hours: 0, lastAt: null, kinds: ["swipe_dislike"] },
];

vi.mock("../services/db", () => ({
  hasPrisma: () => true,
  getPrisma: () => ({
    watchSegment: {
      aggregate: async () => ({ _min: { startedAt: EPOCH } }),
      findMany: async (args: { where: { jellyfinUserId: string } }) => (args.where.jellyfinUserId === "u1" ? SEGMENTS : []),
    },
    tmdbMetaCache: {
      findMany: async (args: { where: { OR: Array<{ mediaType: string; tmdbId: number }> } }) =>
        META.filter((m) => args.where.OR.some((r) => r.mediaType === m.mediaType && r.tmdbId === m.tmdbId)),
    },
    tasteProfile: {
      findUnique: async () => ({
        anchors: JSON.stringify(ANCHORS), potentials: JSON.stringify(POTENTIALS), animeShare: 0.15, computedAt: new Date(NOW - 3_600_000),
      }),
    },
    userRating: { findMany: async () => [{ mediaType: "movie", tmdbId: 603, score: 9 }] },
    userSwipe: {
      findMany: async () => [{ mediaType: "movie", tmdbId: 27205, verdict: "superlike" }, { mediaType: "tv", tmdbId: 1399, verdict: "superlike" }],
    },
    userLike: { findMany: async () => [{ mediaType: "movie", tmdbId: 157336 }] },
    userLikedPerson: { count: async () => 3 },
  }),
}));

import { viewingStatsRoutes } from "./viewingStats";
import { clearViewingStatsCache } from "../services/viewingStats";

const item = (Id: string, Type: string, over: Record<string, unknown> = {}) => ({ Id, Type, Name: Id, ...over });
const MOVIES = [
  item("m1", "Movie", { Name: "Dune", ProviderIds: { Tmdb: "438631" }, Genres: ["Science-Fiction"], ProductionYear: 2021,
    RunTimeTicks: 2.5 * 3600 * TICKS, UserData: { LastPlayedDate: "2026-06-01T20:00:00Z" } }),
  item("m2", "Movie", { Name: "Matrix", ProviderIds: { Tmdb: "603" }, Genres: ["Action"], ProductionYear: 1999,
    RunTimeTicks: 2 * 3600 * TICKS, UserData: { LastPlayedDate: "2026-09-20T22:00:00Z" } }),
];
const EPISODES = [
  item("e1", "Episode", { SeriesId: "s1", SeriesName: "Frieren", RunTimeTicks: 1440 * TICKS, UserData: { LastPlayedDate: "2026-09-26T20:30:00Z" } }),
  item("e2", "Episode", { SeriesId: "s1", SeriesName: "Frieren", RunTimeTicks: 1440 * TICKS, UserData: { LastPlayedDate: "2026-09-26T21:00:00Z" } }),
];
const SERIES = item("s1", "Series", { Name: "Frieren", Genres: ["Anime", "Animation"], ProductionYear: 2023, ProviderIds: { Tmdb: "209867" } });

function jellyfin(url: URL): unknown {
  const p = url.searchParams;
  if (p.get("Ids")) {
    const images = (id: string) => ({ ImageTags: { Primary: `p-${id}` }, BackdropImageTags: [`b-${id}`] });
    return { Items: p.get("Ids")!.split(",").map((id) => ({ ...(id === "s1" ? SERIES : MOVIES.find((m) => m.Id === id)), ...images(id) })) };
  }
  if (p.get("Filters") === "IsFavorite") return { Items: [item("m2", "Movie", { ProviderIds: { Tmdb: "603" } })] };
  if (p.get("IncludeItemTypes") === "Movie") return { Items: MOVIES };
  if (p.get("IncludeItemTypes") === "Episode") return { Items: EPISODES };
  return { Items: [] };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  clearViewingStatsCache();
  state.jellyfinUrl = "http://jf.test";
  state.itemsFail = false;
  calls.length = 0;
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    if (url.pathname === "/Users/Me") {
      return new Response(JSON.stringify({ Id: "u1", Name: "banc", Policy: { IsAdministrator: false } }), { status: 200 });
    }
    calls.push(url.search);
    if (state.itemsFail) return new Response("panne", { status: 500 });
    return new Response(JSON.stringify(jellyfin(url)), { status: 200 });
  }));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function makeApp() {
  const app = Fastify();
  app.setErrorHandler((err: unknown, _req, reply) => {
    if (err instanceof ZodError) return reply.status(400).send({ message: "Validation error" });
    return reply.status(500).send({ message: err instanceof Error ? err.message : "Erreur" });
  });
  await app.register(viewingStatsRoutes, { prefix: "/api/stats" });
  return app;
}

const headers = { "x-emby-token": "jeton-banc" };
const get = async (query: string) => {
  const app = await makeApp();
  const res = await app.inject({ method: "GET", url: `/api/stats/me?${query}`, headers });
  return { status: res.statusCode, body: res.json() as ViewingStats };
};

describe("GET /api/stats/me", () => {
  it("refuse un appel sans jeton", async () => {
    const app = await makeApp();
    expect((await app.inject({ method: "GET", url: "/api/stats/me" })).statusCode).toBe(401);
  });

  it("raccorde l'estimé d'avant la mesure et le mesuré, pour le seul compte appelant", async () => {
    const { status, body } = await get("period=all&tz=Europe/Paris&lang=fr");
    expect(status).toBe(200);
    expect(body.totals).toMatchObject({ seconds: 9000 + 10080, estimatedSeconds: 9000, measuredSeconds: 10080, movies: 2, episodes: 2, series: 1 });
    expect(body.measuredSince).toBe(EPOCH.toISOString());
    expect(body.timeZone).toBe("Europe/Paris");
    expect(calls.every((q) => new URLSearchParams(q).get("userId") === "u1")).toBe(true);
  });

  it("nomme genres et pays d'origine dans la langue demandée, et sépare les animés", async () => {
    const fr = (await get("period=all&tz=Europe/Paris&lang=fr")).body;
    expect(fr.genres[0]).toMatchObject({ key: "878", label: "Science-fiction", seconds: 16200 });
    // Plus jamais la langue ORIGINALE présentée comme la langue écoutée.
    expect(fr.languages).toEqual([]);
    expect(fr.origins.countries.map((c) => [c.label, c.seconds])).toEqual([["États-Unis", 16200], ["Japon", 2880]]);
    expect(fr.origins.unknownShare).toBe(0);
    expect(fr.split).toEqual({ movieSeconds: 16200, seriesSeconds: 0, animeSeconds: 2880 });
    const en = (await get("period=all&tz=Europe/Paris&lang=en")).body;
    expect(en.genres[0].label).toBe("Science Fiction");
    expect(en.origins.countries[1].label).toBe("Japan");
  });

  it("dit depuis quand la piste est relevée, sans part tant que l'échantillon est mince", async () => {
    const { body } = await get("period=all&tz=Europe/Paris&lang=fr");
    // 2 h 48 relevées sur 3 séances : moins de 3 h et de 5 séances.
    expect(body.listening).toEqual({
      versions: null, versionSeconds: 10080, languages: [], otherShare: 0, knownSeconds: 10080, since: "2026-09-20T19:45:00.000Z",
    });
  });

  it("donne titres, visages, appareils et records, avec images et portraits", async () => {
    const { body } = await get("period=all&tz=Europe/Paris");
    expect(body.topSeries).toEqual([
      expect.objectContaining({ id: "s1", episodes: 2, seconds: 2880, anime: true, primaryTag: "p-s1", backdropTag: "b-s1" }),
    ]);
    // Matrix d'abord : noté 9 et favori ; Dune, vu avant la mesure, compte une fois.
    expect(body.movies.map((m) => [m.id, m.viewings, m.rating, m.favorite, m.primaryTag])).toEqual([
      ["m2", 1, 9, true, "p-m2"], ["m1", 1, null, false, "p-m1"],
    ]);
    expect(body.moviesOrder).toBe("preference");
    expect(body.people.actors.map((a) => [a.name, a.profilePath])).toEqual([
      ["Timothée Chalamet", "/tc.jpg"], ["Keanu Reeves", "/keanu.jpg"], ["Atsumi Tanezaki", null],
    ]);
    expect(body.devices).toEqual([
      { device: "mobile", client: null, seconds: 7200 },
      { device: "tv", client: null, seconds: 2880 },
    ]);
    // Deux épisodes de 24 min : 48 min, pas un marathon (une heure au moins).
    expect(body.records.binge).toBeNull();
  });

  it("lit le goût tel quel : titres aimés, notes et signaux, sans l'envie ni le refus", async () => {
    const { body } = await get("period=all&tz=Europe/Paris");
    expect(body.taste.available).toBe(true);
    expect(body.taste.loved.map((l) => [l.title, l.jellyfinId, l.rating, l.reasons])).toEqual([
      ["The Matrix", "m2", 9, ["rating", "completed"]],
      ["Frieren", "s1", null, ["series"]],
    ]);
    expect(body.taste.signals).toEqual({ ratings: 1, ratingAverage: 9, superlikes: 2, likes: 1, dislikes: 0, likedPeople: 3, favorites: 1 });
  });

  it("montre Ma liste seule comme un potentiel « à voir », sans qu'elle pèse sur rien d'autre", async () => {
    const { body } = await get("period=all&tz=Europe/Paris");
    expect(body.taste.potential).toEqual({
      count: 2,
      titles: [
        { key: "movie:27205", mediaType: "movie", tmdbId: 27205, title: "Inception", jellyfinId: "m9", posterPath: null },
        { key: "tv:1399", mediaType: "tv", tmdbId: 1399, title: "Game of Thrones", jellyfinId: null, posterPath: "/got.jpg" },
      ],
    });
    expect(body.taste.loved.map((l) => l.key)).not.toContain("movie:27205");
    expect(body.totals.movies).toBe(2);
    expect(body.origins.countries.map((c) => [c.key, c.seconds])).toEqual([["US", 16200], ["JP", 2880]]);
  });

  it("borne « 30 jours » aux jours locaux récents, sans relancer de calcul", async () => {
    await get("period=all&tz=Europe/Paris");
    const before = calls.length;
    const { body } = await get("period=30d&tz=Europe/Paris");
    expect(calls.length).toBe(before);
    expect(body.totals).toMatchObject({ seconds: 10080, movies: 1, episodes: 2 });
    expect(body.timeline.unit).toBe("day");
  });

  it("répond 503 sans Jellyfin configuré, 502 quand Jellyfin tombe", async () => {
    state.itemsFail = true;
    expect((await get("period=all")).status).toBe(502);
    state.jellyfinUrl = null;
    const app = await makeApp();
    expect((await app.inject({ method: "GET", url: "/api/stats/me", headers })).statusCode).toBe(503);
  });
});
