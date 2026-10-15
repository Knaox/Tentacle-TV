/**
 * Le filtre des titres extérieurs, de bout en bout (Jellyfin, cache des fiches et
 * TMDB simulés) : aucune requête TMDB pour un compte libre, la bonne coupe pour un
 * compte restreint, un budget de lectures, et rien qui passe sur une panne.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  policy: {} as Record<string, unknown> | null,
  rows: new Map<string, string>(),
  tmdbCalls: [] as string[],
  tmdb: new Map<string, unknown>(),
}));

vi.mock("../jellyfinAdminFetch", () => ({
  jellyfinAdminFetch: async (path: string) => {
    if (path.startsWith("/Users/")) return state.policy ? { ok: true, data: { Policy: state.policy } } : { ok: false, failure: "unreachable" };
    if (path === "/System/Configuration") return { ok: true, data: { MetadataCountryCode: "FR" } };
    if (path === "/Localization/ParentalRatings") return { ok: true, data: [{ Name: "12", RatingScore: { score: 12, subScore: null } }] };
    return { ok: false, failure: "invalid" };
  },
}));
vi.mock("../db", () => ({
  hasPrisma: () => true,
  getPrisma: () => ({
    tmdbMetaCache: {
      findMany: async ({ where }: { where: { OR: { mediaType: string; tmdbId: number }[] } }) =>
        where.OR.flatMap(({ mediaType, tmdbId }) => {
          const payload = state.rows.get(`${mediaType}:${tmdbId}`);
          return payload ? [{ mediaType, tmdbId, payload }] : [];
        }),
      findUnique: async ({ where }: { where: { mediaType_tmdbId: { mediaType: string; tmdbId: number } } }) => {
        const { mediaType, tmdbId } = where.mediaType_tmdbId;
        const payload = state.rows.get(`${mediaType}:${tmdbId}`);
        return payload ? { mediaType, tmdbId, payload } : null;
      },
      update: async ({ where, data }: { where: { mediaType_tmdbId: { mediaType: string; tmdbId: number } }; data: { payload: string } }) => {
        state.rows.set(`${where.mediaType_tmdbId.mediaType}:${where.mediaType_tmdbId.tmdbId}`, data.payload);
      },
    },
  }),
}));
vi.mock("../tmdb/client", () => ({
  tmdbConfigured: () => true,
  tmdbFetch: async (path: string) => {
    state.tmdbCalls.push(path);
    if (!state.tmdb.has(path)) throw new Error("404");
    return state.tmdb.get(path);
  },
}));
vi.mock("../tmdb/metaCache", () => ({
  metaKey: (mediaType: string, tmdbId: number) => `${mediaType}:${tmdbId}`,
  getTitleMeta: async (mediaType: string, tmdbId: number) => {
    const key = `${mediaType}:${tmdbId}`;
    if (!state.rows.has(key)) {
      state.tmdbCalls.push(`/${mediaType}/${tmdbId}`);
      state.rows.set(key, JSON.stringify({ id: tmdbId, adult: false, keywords: { keywords: [] } }));
    }
    return { mediaType, tmdbId };
  },
}));

import { clearContentPolicyCache } from "./contentPolicy";
import { EXTERNAL_FETCH_BUDGET, filterExternalTitles } from "./externalTitles";
import { clearRatingContext } from "./ratingContext";

const USER = "8f0c2f4a9e7b4d1c8a3b2c1d0e9f8a7b";

function cached(tmdbId: number, fr: string | null, extra: Record<string, unknown> = {}) {
  const release_dates = { results: fr ? [{ iso_3166_1: "FR", release_dates: [{ certification: fr }] }] : [] };
  state.rows.set(`movie:${tmdbId}`, JSON.stringify({ id: tmdbId, adult: false, keywords: { keywords: [] }, release_dates, ...extra }));
}

beforeEach(() => {
  clearContentPolicyCache();
  clearRatingContext();
  state.policy = {};
  state.rows.clear();
  state.tmdb.clear();
  state.tmdbCalls = [];
});

describe("filterExternalTitles", () => {
  it("compte non restreint : la liste telle quelle, aucune requête TMDB", async () => {
    const titles = [{ mediaType: "movie" as const, tmdbId: 1, extra: "garde" }];
    const result = await filterExternalTitles(USER, titles);
    expect(result).toEqual(titles);
    expect(result[0]).toBe(titles[0]);
    expect(state.tmdbCalls).toEqual([]);
  });

  it("compte restreint à 12 : la coupe, dans l'ordre reçu", async () => {
    state.policy = { MaxParentalRating: 12 };
    cached(1, "12");
    cached(2, "16");
    cached(3, null);
    cached(4, "TP", { adult: true });
    cached(5, "10");
    const titles = [1, 2, 3, 4, 5].map((tmdbId) => ({ mediaType: "movie" as const, tmdbId }));
    expect((await filterExternalTitles(USER, titles)).map((title) => title.tmdbId)).toEqual([1, 5]);
    expect(state.tmdbCalls).toEqual([]);
  });

  it("une fiche sans certifications : lue chez TMDB une fois, puis gardée dans la fiche", async () => {
    state.policy = { MaxParentalRating: 12 };
    state.tmdb.set("/movie/7/release_dates", { results: [{ iso_3166_1: "FR", release_dates: [{ certification: "10", type: 3 }] }] });
    const title = [{ mediaType: "movie" as const, tmdbId: 7 }];
    expect(await filterExternalTitles(USER, title)).toEqual(title);
    expect(state.tmdbCalls).toEqual(["/movie/7", "/movie/7/release_dates"]);
    expect(await filterExternalTitles(USER, title)).toEqual(title);
    expect(state.tmdbCalls).toHaveLength(2);
  });

  it("une série : `content_ratings`, réduits aux notes non vides", async () => {
    state.policy = { MaxParentalRating: 12 };
    state.tmdb.set("/tv/9/content_ratings", { results: [{ iso_3166_1: "FR", rating: "16" }, { iso_3166_1: "US", rating: "" }] });
    state.tmdb.set("/tv/8/content_ratings", { results: [{ iso_3166_1: "FR", rating: "10", descriptors: [] }] });
    const series = [9, 8].map((tmdbId) => ({ mediaType: "tv" as const, tmdbId }));
    expect((await filterExternalTitles(USER, series)).map((title) => title.tmdbId)).toEqual([8]);
    expect(JSON.parse(state.rows.get("tv:9") ?? "{}").content_ratings).toEqual({ results: [{ iso_3166_1: "FR", rating: "16" }] });
  });

  it("au-delà du budget : caché cette fois, lu en fond", async () => {
    state.policy = { BlockUnratedItems: ["Movie"] };
    const titles = Array.from({ length: EXTERNAL_FETCH_BUDGET + 3 }, (_, index) => ({ mediaType: "movie" as const, tmdbId: 100 + index }));
    for (const title of titles) state.tmdb.set(`/movie/${title.tmdbId}/release_dates`, { results: [{ iso_3166_1: "US", release_dates: [{ certification: "PG" }] }] });
    const first = await filterExternalTitles(USER, titles);
    expect(first).toHaveLength(EXTERNAL_FETCH_BUDGET);
    await vi.waitFor(() => expect(state.rows.get(`movie:${100 + EXTERNAL_FETCH_BUDGET + 2}`)).toContain("release_dates"));
    expect(await filterExternalTitles(USER, titles)).toHaveLength(titles.length);
  });

  it("Jellyfin muet : rien d'extérieur", async () => {
    state.policy = null;
    cached(1, "TP");
    expect(await filterExternalTitles(USER, [{ mediaType: "movie", tmdbId: 1 }])).toEqual([]);
  });
});
