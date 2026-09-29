/**
 * Le partage des statistiques de bout en bout, côté serveur : le lien du
 * propriétaire (créer, changer de période, révoquer), la page PUBLIQUE (sans
 * compte, liste blanche, jamais un recalcul forcé), les fiches publiques
 * qu'elle peut ouvrir, le plafond de débit — et les listes, qui ne bougent pas.
 */

import Fastify from "fastify";
import rateLimit from "@fastify/rate-limit";
import { ZodError } from "zod";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ViewingStats } from "../services/viewingStats/contract";
import { JellyfinUnavailable } from "../services/viewingStats/jellyfinScan";

const H = 3600;
const state = {
  jellyfinUrl: "http://jf.test" as string | null,
  statsFail: null as Error | null,
  missingColumn: false,
};

interface Row { token: string; ownerUserId: string; ownerUsername: string; kind: string; options: string | null }
const rows: Row[] = [];
const statsCalls: Array<{ userId: string; req: Record<string, unknown> }> = [];
const detailCalls: Array<[string, string]> = [];

const pick = (row: Row, select?: Record<string, boolean>) =>
  select ? Object.fromEntries(Object.keys(select).map((k) => [k, row[k as keyof Row]])) : row;
const byWhere = (where: { token?: string; ownerUserId_kind?: { ownerUserId: string; kind: string } }) =>
  rows.find((r) => (where.token ? r.token === where.token
    : r.ownerUserId === where.ownerUserId_kind?.ownerUserId && r.kind === where.ownerUserId_kind?.kind));
const missing = () => Object.assign(new Error("colonne options inconnue"), { code: "P2022" });

vi.mock("../services/db", () => ({
  getPrisma: () => ({
    shareLink: {
      upsert: async ({ where, create, update, select }: { where: never; create: Row; update: Partial<Row>; select?: Record<string, boolean> }) => {
        if (state.missingColumn && ("options" in create)) throw missing();
        const found = byWhere(where);
        if (found) Object.assign(found, update);
        else rows.push({ ...create, options: create.options ?? null });
        return pick(found ?? rows[rows.length - 1], select);
      },
      findUnique: async ({ where, select }: { where: never; select?: Record<string, boolean> }) => {
        if (state.missingColumn && select?.options) throw missing();
        const found = byWhere(where);
        return found ? pick(found, select) : null;
      },
      deleteMany: async ({ where }: { where: { ownerUserId: string; kind: string } }) => {
        const before = rows.length;
        for (let i = rows.length - 1; i >= 0; i--) if (rows[i].ownerUserId === where.ownerUserId && rows[i].kind === where.kind) rows.splice(i, 1);
        return { count: before - rows.length };
      },
    },
  }),
}));

vi.mock("../middleware/auth", () => ({
  requireAuth: async (request: { headers: Record<string, string>; user?: unknown }, reply: { status: (n: number) => { send: (b: unknown) => unknown } }) => {
    const id = request.headers["x-test-user"];
    if (!id) return reply.status(401).send({ message: "Unauthorized" });
    request.user = { userId: id, username: id === "u1" ? "Knaoxtest" : "Knaoxtest2", isAdmin: false };
  },
}));

vi.mock("../services/configStore", () => ({ getJellyfinUrl: () => state.jellyfinUrl, getJellyfinApiKey: () => "cle-admin" }));

vi.mock("../services/viewingStats", () => ({
  getViewingStats: async (userId: string, req: Record<string, unknown>) => {
    statsCalls.push({ userId, req });
    if (state.statsFail) throw state.statsFail;
    return ownerStats(req.period as ViewingStats["period"], req.timeZone as string);
  },
}));

vi.mock("../services/jellyfin", () => ({
  getUserWatchlist: async () => ({ Items: [{ Id: "w1", Name: "Alien", Type: "Movie", ProductionYear: 1979, ImageTags: { Primary: "t" } }] }),
  getItemDetail: async (userId: string, itemId: string) => {
    detailCalls.push([userId, itemId]);
    return { Id: itemId, Name: itemId, Overview: "Résumé", UserData: { Played: true, LastPlayedDate: "2026-09-26T23:00:00Z" } };
  },
}));

vi.mock("../services/shareLists", () => ({ getLikedListItems: async () => [] }));

function ownerStats(period: ViewingStats["period"], timeZone: string): ViewingStats {
  const grid = new Array<number>(168).fill(0);
  grid[4 * 24 + 23] = 2 * H;
  const title = (id: string, kind: "movie" | "series") => ({
    id, name: id, kind, seconds: 2 * H, episodes: kind === "series" ? 4 : 0, viewings: kind === "movie" ? 1 : 0, rating: null,
    favorite: false, verdict: null, year: 2020, anime: false, primaryTag: `p-${id}`, backdropTag: `b-${id}`,
    lastPlayedAt: "2026-09-26T23:12:00.000Z",
  });
  return {
    period, timeZone, generatedAt: "2026-09-29T11:00:00.000Z", measuredSince: "2026-06-01T10:00:00.000Z", hasHistory: true,
    totals: { seconds: 20 * H, measuredSeconds: 2 * H, estimatedSeconds: 18 * H, movies: 1, episodes: 4, series: 1, activeDays: 3 },
    timeline: { unit: "month", buckets: [], undatedSeconds: 0 }, rhythm: { grid },
    split: { movieSeconds: 2 * H, seriesSeconds: 18 * H, animeSeconds: 0 }, genres: [], languages: [],
    origins: { countries: [], otherShare: 0, unknownShare: 0 },
    listening: { versions: null, versionSeconds: 0, languages: [], otherShare: 0, knownSeconds: 0, since: null },
    decades: [], devices: [{ device: "other", seconds: 2 * H, client: "Infuse du salon" }],
    topSeries: [title("s1", "series")], movies: [title("m1", "movie")], moviesOrder: "preference",
    people: { actors: [], directors: [] },
    records: { biggestDay: { date: "2026-09-14", seconds: 5 * H }, longestStreak: null, binge: null, longestSession: null },
    taste: { available: true, computedAt: "2026-09-29T03:00:00.000Z", animeShare: 0,
      loved: [{ key: "tv:1", mediaType: "tv", tmdbId: 1, title: "s1", jellyfinId: "s9", posterPath: null, reasons: ["series"], rating: null, hours: 2 }],
      signals: { ratings: 0, ratingAverage: null, superlikes: 0, likes: 0, dislikes: 0, likedPeople: 0, favorites: 0 },
      potential: { count: 1, titles: [{ key: "movie:9", mediaType: "movie", tmdbId: 9, title: "Titre secret de Ma liste", jellyfinId: "w9", posterPath: null }] } },
  };
}

import { shareRoutes } from "./share";

async function makeApp() {
  const app = Fastify();
  // Comme le gestionnaire de l'application : un 4xx (le 429 du plafond) passe tel quel.
  app.setErrorHandler((err: unknown, _req, reply) => {
    if (err instanceof ZodError) return reply.status(400).send({ message: "Validation error" });
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    return reply.status(status).send({ message: err instanceof Error ? err.message : "Erreur" });
  });
  // Le plafond global de l'application : les routes publiques en déclarent un plus bas.
  await app.register(rateLimit, { max: 1000, timeWindow: "1 minute" });
  await app.register(shareRoutes, { prefix: "/api/share" });
  return app;
}

const as = (user: string) => ({ "x-test-user": user });

beforeEach(() => {
  rows.length = 0;
  statsCalls.length = 0;
  detailCalls.length = 0;
  state.jellyfinUrl = "http://jf.test";
  state.statsFail = null;
  state.missingColumn = false;
});

describe("le lien du propriétaire", () => {
  it("se crée avec sa période, se change sans changer de jeton, et se lit", async () => {
    const app = await makeApp();
    expect((await app.inject({ method: "POST", url: "/api/share/stats", payload: { period: "30d" } })).statusCode).toBe(401);

    const first = await app.inject({ method: "POST", url: "/api/share/stats", headers: as("u1"), payload: { period: "30d", tz: "Europe/Zurich" } });
    expect(first.statusCode).toBe(200);
    const { token } = first.json() as { token: string };
    expect(token).toMatch(/^[0-9a-f]{16}$/);
    expect(first.json()).toEqual({ token, period: "30d" });
    expect(JSON.parse(rows[0].options!)).toEqual({ period: "30d", tz: "Europe/Zurich" });

    const second = await app.inject({ method: "POST", url: "/api/share/stats", headers: as("u1"), payload: { period: "year", tz: "Europe/Zurich" } });
    expect(second.json()).toEqual({ token, period: "year" });
    expect(rows).toHaveLength(1);

    expect((await app.inject({ method: "GET", url: "/api/share/stats/mine", headers: as("u1") })).json()).toEqual({ token, period: "year" });
    expect((await app.inject({ method: "GET", url: "/api/share/stats/mine", headers: as("u2") })).json()).toEqual({ token: null, period: null });
  });

  it("refuse une période inconnue et ramène un fuseau inventé à UTC", async () => {
    const app = await makeApp();
    expect((await app.inject({ method: "POST", url: "/api/share/stats", headers: as("u1"), payload: { period: "forever" } })).statusCode).toBe(400);
    await app.inject({ method: "POST", url: "/api/share/stats", headers: as("u1"), payload: { period: "all", tz: "Mars/Olympus" } });
    expect(JSON.parse(rows[0].options!)).toEqual({ period: "all", tz: "UTC" });
  });

  it("dit « base à mettre à jour » quand la colonne manque — sans toucher aux listes", async () => {
    const app = await makeApp();
    state.missingColumn = true;
    expect((await app.inject({ method: "POST", url: "/api/share/stats", headers: as("u1"), payload: { period: "all" } })).statusCode).toBe(503);
    expect((await app.inject({ method: "GET", url: "/api/share/stats/mine", headers: as("u1") })).statusCode).toBe(503);
    const list = await app.inject({ method: "POST", url: "/api/share/", headers: as("u1") });
    expect(list.statusCode).toBe(200);
    const listToken = (list.json() as { token: string }).token;
    expect((await app.inject({ method: "GET", url: `/api/share/${listToken}` })).json()).toMatchObject({ kind: "watchlist" });
  });
});

describe("la page publique d'un lien de statistiques", () => {
  async function shared(period = "30d") {
    const app = await makeApp();
    const res = await app.inject({ method: "POST", url: "/api/share/stats", headers: as("u1"), payload: { period, tz: "Europe/Zurich" } });
    return { app, token: (res.json() as { token: string }).token };
  }

  it("s'ouvre sans compte, sur la période et le fuseau du propriétaire, sans jamais forcer de calcul", async () => {
    const { app, token } = await shared("year");
    const res = await app.inject({ method: "GET", url: `/api/share/${token}?lang=en&refresh=1` });
    expect(res.statusCode).toBe(200);
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(statsCalls).toEqual([{ userId: "u1", req: { period: "year", timeZone: "Europe/Zurich", lang: "en", refresh: false } }]);
    const body = res.json() as { kind: string; ownerUsername: string; stats: { period: string; habits: unknown; records: { biggestDay: { date: string } } } };
    expect(body.kind).toBe("stats");
    expect(body.ownerUsername).toBe("Knaoxtest");
    expect(body.stats.period).toBe("year");
    expect(body.stats.habits).toBeDefined();
    expect(body.stats.records.biggestDay.date).toBe("2026-09");
  });

  it("ne transmet ni fuseau, ni écran, ni heure, ni « À voir », ni l'identifiant du propriétaire", async () => {
    const { app, token } = await shared();
    const text = (await app.inject({ method: "GET", url: `/api/share/${token}` })).body;
    for (const secret of ["Europe/Zurich", "Infuse", "Titre secret", "23:12", "grid", "devices", "lastPlayedAt", "potential", "u1", "timeZone"]) {
      expect(text, secret).not.toContain(secret);
    }
  });

  it("n'ouvre que les fiches des titres montrés, sans l'historique du propriétaire", async () => {
    const { app, token } = await shared();
    const detail = await app.inject({ method: "GET", url: `/api/share/${token}/item/m1` });
    expect(detail.statusCode).toBe(200);
    expect(detail.json()).toEqual({ Id: "m1", Name: "m1", Overview: "Résumé" });
    expect((await app.inject({ method: "GET", url: `/api/share/${token}/item/s9` })).statusCode).toBe(200);
    // Un titre de la bibliothèque que la page ne montre pas : introuvable.
    expect((await app.inject({ method: "GET", url: `/api/share/${token}/item/w9` })).statusCode).toBe(404);
    expect((await app.inject({ method: "GET", url: `/api/share/${token}/item/autre` })).statusCode).toBe(404);
    expect(detailCalls).toEqual([["u1", "m1"], ["u1", "s9"]]);
  });

  it("disparaît à la révocation : la page et ses fiches répondent 404", async () => {
    const { app, token } = await shared();
    expect((await app.inject({ method: "DELETE", url: "/api/share/stats", headers: as("u1") })).json()).toEqual({ ok: true });
    expect((await app.inject({ method: "GET", url: `/api/share/${token}` })).statusCode).toBe(404);
    expect((await app.inject({ method: "GET", url: `/api/share/${token}/item/m1` })).statusCode).toBe(404);
    expect((await app.inject({ method: "GET", url: "/api/share/stats/mine", headers: as("u1") })).json()).toEqual({ token: null, period: null });
  });

  it("dit 404 à un jeton inconnu, 502 quand Jellyfin tombe, 503 sans Jellyfin", async () => {
    const { app, token } = await shared();
    expect((await app.inject({ method: "GET", url: "/api/share/0000000000000000" })).statusCode).toBe(404);
    state.statsFail = new JellyfinUnavailable("panne");
    expect((await app.inject({ method: "GET", url: `/api/share/${token}` })).statusCode).toBe(502);
    state.jellyfinUrl = null;
    expect((await app.inject({ method: "GET", url: `/api/share/${token}` })).statusCode).toBe(503);
  });

  it("plafonne les appels publics à soixante par minute et par adresse", async () => {
    const app = await makeApp();
    const codes: number[] = [];
    for (let i = 0; i < 61; i++) codes.push((await app.inject({ method: "GET", url: `/api/share/jeton${i}` })).statusCode);
    expect(codes.slice(0, 60).every((c) => c === 404)).toBe(true);
    expect(codes[60]).toBe(429);
  });
});
