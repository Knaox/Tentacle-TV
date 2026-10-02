import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { JellyfinClient } from "../jellyfin";

/**
 * Sous un `fetch` qui ne se résout qu'une fois le corps ENTIER reçu (React
 * Native) — l'opt-in `bufferedFetch` : le réseau se mesure de la requête à la
 * réponse, moins la latence ; la conversion du corps ne compte jamais.
 */

const client = {
  getDirectStreaming: () => null,
  getAuthHeader: () => 'MediaBrowser Token="proxy"',
  getAccessToken: () => "jwt",
  getBaseUrl: () => "https://tentacle.test/api/jellyfin",
  useCredentials: false,
} as unknown as JellyfinClient;

/** Un fetch « React Native » : la réponse n'arrive qu'avec le corps entier, et
 *  sa conversion (`arrayBuffer`) prend `convertMs` de plus. */
function rnFetch(o: { latencyMs: number; bps: number; convertMs: number }, calls: string[] = []) {
  return vi.fn(async (url: string) => {
    calls.push(url);
    const size = Number(new URL(url).searchParams.get("size"));
    await new Promise((resolve) => setTimeout(resolve, o.latencyMs + (size * 8 * 1000) / o.bps));
    return {
      ok: true,
      arrayBuffer: () => new Promise((resolve) => setTimeout(() => resolve(new ArrayBuffer(0)), o.convertMs)),
      text: async () => "",
    };
  });
}

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function measure(options: { bufferedFetch?: boolean }): Promise<number | null> {
  const { measureBitrate } = await import("./bitrateMeasure");
  const pending = measureBitrate(client, options);
  await vi.advanceTimersByTimeAsync(60_000);
  return pending;
}

describe("bitrateMeasure — un fetch qui attend le corps entier (opt-in)", () => {
  it("conversion lente, réseau rapide : c'est le réseau qu'on mesure", async () => {
    vi.stubGlobal("fetch", rnFetch({ latencyMs: 20, bps: 200e6, convertMs: 900 }));
    const bps = await measure({ bufferedFetch: true });
    expect(bps).toBeGreaterThan(190e6);
    expect(bps).toBeLessThan(210e6);
  });

  it("réseau lent, conversion rapide : le réseau aussi", async () => {
    vi.stubGlobal("fetch", rnFetch({ latencyMs: 30, bps: 5e6, convertMs: 200 }));
    const bps = await measure({ bufferedFetch: true });
    expect(bps).toBeGreaterThan(4.8e6);
    expect(bps).toBeLessThan(5.2e6);
  });

  it("la latence d'abord (deux petites requêtes), puis le témoin, deux passes", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", rnFetch({ latencyMs: 10, bps: 100e6, convertMs: 50 }, calls));
    await measure({ bufferedFetch: true });
    expect(calls.map((url) => new URL(url).searchParams.get("size"))).toEqual(["1000", "1000", "3000000", "3000000"]);
  });

  it("le piège, sans l'opt-in : la mesure d'origine ne voit que la conversion", async () => {
    vi.stubGlobal("fetch", rnFetch({ latencyMs: 30, bps: 5e6, convertMs: 200 }));
    // 3 Mo « en 0,2 s » : 120 Mb/s — quel que soit le réseau (5 Mb/s ici).
    expect(await measure({})).toBe(120_000_000);
  });

  it("un réseau trop lent pour le témoin (délai dépassé) : pas de mesure", async () => {
    vi.stubGlobal("fetch", rnFetch({ latencyMs: 30, bps: 2e6, convertMs: 100 }));
    expect(await measure({ bufferedFetch: true })).toBeNull();
  });
});
