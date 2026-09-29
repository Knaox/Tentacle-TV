import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TentacleApiError } from "./usePreferences";
import { fetchMyStatsShare, revokeStatsShare, saveStatsShare, statsShareFailure } from "./useStatsShare";

const calls: Array<{ url: string; method: string; body: unknown }> = [];

beforeEach(() => {
  calls.length = 0;
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), method: init?.method ?? "GET", body: init?.body ? JSON.parse(String(init.body)) : null });
    return new Response(JSON.stringify({ token: "0123456789abcdef", period: "30d" }), { status: 200 });
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("le lien de partage des statistiques", () => {
  it("se crée avec la période choisie et le fuseau de l'appareil", async () => {
    expect(await saveStatsShare("30d")).toEqual({ token: "0123456789abcdef", period: "30d" });
    expect(calls[0].url).toBe("/api/share/stats");
    expect(calls[0].method).toBe("POST");
    expect(calls[0].body).toMatchObject({ period: "30d" });
    expect(typeof (calls[0].body as { tz: unknown }).tz).toBe("string");
  });

  it("se lit et se révoque sur les routes du propriétaire", async () => {
    await fetchMyStatsShare();
    await revokeStatsShare();
    expect(calls.map((c) => [c.method, c.url])).toEqual([["GET", "/api/share/stats/mine"], ["DELETE", "/api/share/stats"]]);
  });

  it("distingue un serveur ou une base à mettre à jour d'un échec passager", () => {
    expect(statsShareFailure(new TentacleApiError("Not Found", 404))).toBe("outdated");
    expect(statsShareFailure(new TentacleApiError('{"message":"Base à mettre à jour : share_links.options"}', 503))).toBe("outdated");
    expect(statsShareFailure(new TentacleApiError("Jellyfin unreachable", 503))).toBe("error");
    expect(statsShareFailure(new TentacleApiError("Internal server error", 500))).toBe("error");
    expect(statsShareFailure(new Error("réseau"))).toBe("error");
  });
});
