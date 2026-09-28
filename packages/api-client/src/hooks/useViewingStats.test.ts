import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TentacleApiError } from "./usePreferences";
import { fetchViewingStats, viewingStatsFailure, viewingStatsKey } from "./useViewingStats";

const urls: string[] = [];

beforeEach(() => {
  urls.length = 0;
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    urls.push(String(input));
    return new Response(JSON.stringify({ period: "30d" }), { status: 200 });
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
