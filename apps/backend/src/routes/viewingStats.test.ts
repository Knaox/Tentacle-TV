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
    title: "The Matrix", genres: [{ id: 28, name: "Action" }, { id: 878, name: "SF" }], original_language: "en",
    release_date: "1999-03-31", poster_path: "/matrix.jpg",
    credits: { cast: [{ id: 6384, name: "Keanu Reeves", order: 0, profile_path: "/keanu.jpg" }],
      crew: [{ id: 9340, name: "Lana Wachowski", job: "Director", profile_path: "/lana.jpg" }] },
  }),
  tmdb("movie", 438631, {
    title: "Dune", genres: [{ id: 878, name: "SF" }, { id: 12, name: "Aventure" }], original_language: "en",
    credits: { cast: [{ id: 1190668, name: "Timothée Chalamet", order: 0, profile_path: "/tc.jpg" }],
      crew: [{ id: 137427, name: "Denis Villeneuve", job: "Director" }] },
  }),
  tmdb("tv", 209867, {
    name: "Frieren", genres: [{ id: 16, name: "Animation" }, { id: 10765, name: "SF & F" }], original_language: "ja",
    origin_country: ["JP"], credits: { cast: [{ id: 1, name: "Atsumi Tanezaki", order: 0 }] },
  }),
];

const seg = (itemId: string, itemType: string, start: string, seconds: number, extra: Record<string, unknown>) => ({
  itemId, itemType, itemName: itemId, seriesId: null, seriesName: null, runtimeSeconds: null,
  seconds, startedAt: new Date(start), lastSeenAt: new Date(Date.parse(start) + seconds * 1000), ...extra,
});
const SEGMENTS = [
  seg("m2", "Movie", "2026-09-20T19:45:00Z", 7200, { itemName: "Matrix", clientName: "Tentacle TV - Mobile", runtimeSeconds: 8160 }),
  seg("e1", "Episode", "2026-09-26T20:05:00Z", 1440, { seriesId: "s1", seriesName: "Frieren", clientName: "Tentacle TV - TV" }),
  seg("e2", "Episode", "2026-09-26T20:32:00Z", 1440, { seriesId: "s1", seriesName: "Frieren", clientName: "Tentacle TV - TV" }),
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
      findUnique: async () => ({ anchors: JSON.stringify(ANCHORS), animeShare: 0.15, computedAt: new Date(NOW - 3_600_000) }),
    },
    userRating: { findMany: async () => [{ mediaType: "movie", tmdbId: 603, score: 9 }] },
    userSwipe: { groupBy: async () => [{ verdict: "superlike", _count: { _all: 2 } }] },
    userLike: { count: async () => 1 },
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

  it("nomme genres et langues dans la langue demandée, et sépare les animés", async () => {
    const fr = (await get("period=all&tz=Europe/Paris&lang=fr")).body;
    expect(fr.genres[0]).toMatchObject({ key: "878", label: "Science-fiction", seconds: 16200 });
    expect(fr.languages.map((l) => l.label)).toEqual(["Anglais", "Japonais"]);
    expect(fr.split).toEqual({ movieSeconds: 16200, seriesSeconds: 0, animeSeconds: 2880 });
    const en = (await get("period=all&tz=Europe/Paris&lang=en")).body;
    expect(en.genres[0].label).toBe("Science Fiction");
    expect(en.languages[1].label).toBe("Japanese");
  });

  it("donne titres, visages, appareils et records, avec images et portraits", async () => {
    const { body } = await get("period=all&tz=Europe/Paris");
    expect(body.topSeries).toEqual([
      expect.objectContaining({ id: "s1", episodes: 2, seconds: 2880, anime: true, primaryTag: "p-s1", backdropTag: "b-s1" }),
    ]);
    expect(body.movies.map((m) => [m.id, m.viewings, m.primaryTag])).toEqual([["m2", 1, "p-m2"], ["m1", 0, "p-m1"]]);
    expect(body.people.actors.map((a) => [a.name, a.profilePath])).toEqual([
      ["Timothée Chalamet", "/tc.jpg"], ["Keanu Reeves", "/keanu.jpg"], ["Atsumi Tanezaki", null],
    ]);
    expect(body.devices).toEqual([
      { device: "mobile", client: null, seconds: 7200 },
      { device: "tv", client: null, seconds: 2880 },
    ]);
    expect(body.records.binge).toMatchObject({ seriesId: "s1", seriesName: "Frieren", episodes: 2, date: "2026-09-26" });
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
