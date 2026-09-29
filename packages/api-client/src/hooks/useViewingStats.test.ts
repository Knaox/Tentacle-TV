import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TentacleApiError } from "./usePreferences";
import { fetchViewingStats, viewingStatsFailure, viewingStatsKey } from "./useViewingStats";

const urls: string[] = [];

/** La réponse d'un serveur d'avant l'origine et l'écoute — sa forme minimale. */
const LEGACY = {
  period: "30d",
  languages: [{ key: "en", label: "Anglais", seconds: 3600, share: 0.65 }],
  movies: [{ id: "m1", kind: "movie", viewings: 0 }],
  topSeries: [],
  records: { biggestDay: null, longestStreak: null, binge: { seriesId: "s", seriesName: "Dark", episodes: 9, date: "" }, longestSession: null },
  taste: { available: true, computedAt: null, animeShare: 0, loved: [], signals: {} },
};

beforeEach(() => {
  urls.length = 0;
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    urls.push(String(input));
    return new Response(JSON.stringify(LEGACY), { status: 200 });
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchViewingStats", () => {
  it("demande la période, la langue et le fuseau de l'appareil", async () => {
    await fetchViewingStats("30d", "fr");
    const url = new URL(urls[0], "http://x");
    expect(url.pathname).toBe("/api/stats/me");
    expect(url.searchParams.get("period")).toBe("30d");
    expect(url.searchParams.get("lang")).toBe("fr");
    expect(url.searchParams.get("tz")).toBeTruthy();
    expect(url.searchParams.has("refresh")).toBe(false);
  });

  it("ne demande un recalcul que sur « tirer pour rafraîchir »", async () => {
    await fetchViewingStats("all", "en", { refresh: true });
    expect(new URL(urls[0], "http://x").searchParams.get("refresh")).toBe("1");
  });

  it("remet la réponse d'un serveur plus ancien à la forme du contrat, sans rien inventer", async () => {
    const stats = await fetchViewingStats("30d", "fr");
    expect(stats.origins.countries).toEqual([]);
    expect(stats.listening).toMatchObject({ versions: null, languages: [], since: null });
    expect(stats.moviesOrder).toBe("recent");
    expect(stats.movies[0]).toMatchObject({ viewings: 1, rating: null, favorite: false, verdict: null });
    expect(stats.records.binge?.seconds).toBe(0);
    expect(stats.taste.potential).toBeNull();
  });
});

describe("les clés et les échecs", () => {
  it("range chaque période, langue et fuseau à part", () => {
    const key = viewingStatsKey("year", "fr");
    expect(key.slice(0, 3)).toEqual(["viewing-stats", "year", "fr"]);
    expect(viewingStatsKey("30d", "fr")).not.toEqual(key);
  });

  it("distingue un serveur trop ancien d'un serveur injoignable", () => {
    expect(viewingStatsFailure(new TentacleApiError("Not Found", 404))).toBe("outdated");
    expect(viewingStatsFailure(new TentacleApiError("Bad Gateway", 502))).toBe("unavailable");
    expect(viewingStatsFailure(new Error("réseau"))).toBe("unavailable");
  });
});
