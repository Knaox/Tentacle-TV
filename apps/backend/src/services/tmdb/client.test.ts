/**
 * Le cadencement du client TMDB : deux files (interactive devant le fond),
 * un créneau tous les MIN_INTERVAL_MS, dédup des GET en vol, relance sur 429
 * qui reprend un créneau. `fetch` est un faux global, le temps est factice.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../configStore", () => ({
  getConfigValue: (key: string) => (key === "tmdb_api_key" ? "test-key" : undefined),
}));

import { resetTmdbClientForTests, setTmdbTransport, tmdbFetch, tmdbLastInteractiveAt } from "./client";

let calls: Array<{ path: string; at: number }> = [];
let rateLimitOnce = false;

function pathOf(url: string): string {
  const m = /\/3(\/[^?]*)/.exec(url);
  return m ? m[1] : url;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-04T10:00:00Z"));
  resetTmdbClientForTests();
  calls = [];
  rateLimitOnce = false;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push({ path: pathOf(url), at: Date.now() });
      if (rateLimitOnce) {
        rateLimitOnce = false;
        return new Response("{}", { status: 429, headers: { "retry-after": "1" } });
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("client TMDB — lanes de priorité", () => {
  it("l'interactif passe devant le fond, un créneau tous les 250 ms", async () => {
    const all = Promise.all([
      tmdbFetch("/bg1", {}, { priority: "background" }),
      tmdbFetch("/bg2", {}, { priority: "background" }),
      tmdbFetch("/bg3", {}, { priority: "background" }),
      tmdbFetch("/int1"),
    ]);
    await vi.advanceTimersByTimeAsync(2_000);
    await all;
    expect(calls.map((c) => c.path)).toEqual(["/bg1", "/int1", "/bg2", "/bg3"]);
    const t0 = calls[0].at;
    expect(calls.map((c) => c.at - t0)).toEqual([0, 250, 500, 750]);
  });

  it("deux GET identiques en vol ne coûtent qu'un appel", async () => {
    const a = tmdbFetch("/movie/1", { x: "1" });
    const b = tmdbFetch("/movie/1", { x: "1" });
    await vi.advanceTimersByTimeAsync(10);
    await Promise.all([a, b]);
    expect(calls).toHaveLength(1);
  });

  it("sur 429, la relance reprend un créneau et laisse passer l'interactif arrivé entre-temps", async () => {
    rateLimitOnce = true;
    const bg = tmdbFetch("/bg", {}, { priority: "background" });
    await vi.advanceTimersByTimeAsync(300);
    const int = tmdbFetch("/int");
    await vi.advanceTimersByTimeAsync(2_000);
    await Promise.all([bg, int]);
    expect(calls.map((c) => c.path)).toEqual(["/bg", "/int", "/bg"]);
    expect(calls[2].at - calls[0].at).toBeGreaterThanOrEqual(1_100);
  });

  it("un GET de fond rejoint par un interactif passe dans la file interactive, sans second appel", async () => {
    const all = Promise.all([
      tmdbFetch("/bg1", {}, { priority: "background" }),
      tmdbFetch("/bg2", {}, { priority: "background" }),
      tmdbFetch("/bg3", {}, { priority: "background" }),
    ]);
    await vi.advanceTimersByTimeAsync(10);
    // /bg3 attend derrière /bg2 : un survol le réclame — il passe devant.
    const joined = tmdbFetch("/bg3");
    await vi.advanceTimersByTimeAsync(2_000);
    await Promise.all([all, joined]);
    expect(calls.map((c) => c.path)).toEqual(["/bg1", "/bg3", "/bg2"]);
  });

  it("seul un créneau interactif marque tmdbLastInteractiveAt", async () => {
    const bg = tmdbFetch("/bg", {}, { priority: "background" });
    await vi.advanceTimersByTimeAsync(10);
    await bg;
    expect(tmdbLastInteractiveAt()).toBe(0);
    const int = tmdbFetch("/int");
    await vi.advanceTimersByTimeAsync(300);
    await int;
    expect(tmdbLastInteractiveAt()).toBeGreaterThan(0);
  });
});

describe("client TMDB — transport remplaçable (banc de recommandation)", () => {
  it("un transport qui relit sa bande ne touche jamais le réseau ; la clé n'est pas dans les paramètres", async () => {
    const seen: Array<{ path: string; params: Record<string, string> }> = [];
    setTmdbTransport(async <T>(path: string, params: Record<string, string>) => {
      seen.push({ path, params });
      return { replayed: path } as T;
    });
    const out = await tmdbFetch<{ replayed: string }>("/movie/603/recommendations", { page: "1" });
    expect(out).toEqual({ replayed: "/movie/603/recommendations" });
    expect(calls).toHaveLength(0);
    expect(seen).toEqual([{ path: "/movie/603/recommendations", params: { page: "1" } }]);
  });

  it("un transport qui enregistre passe par le vrai appel, cadencé", async () => {
    const taped: unknown[] = [];
    setTmdbTransport(async <T>(_path: string, _params: Record<string, string>, network: () => Promise<T>) => {
      const value = await network();
      taped.push(value);
      return value;
    });
    const pending = tmdbFetch("/trending/movie/week");
    await vi.advanceTimersByTimeAsync(10);
    await pending;
    expect(calls.map((c) => c.path)).toEqual(["/trending/movie/week"]);
    expect(taped).toEqual([{ ok: true }]);
  });
});
