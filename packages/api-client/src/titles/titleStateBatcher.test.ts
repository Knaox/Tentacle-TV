import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TitleProvider } from "@tentacle-tv/shared";
import { loadTitleState } from "./titleStateBatcher";

const provider: TitleProvider = { pluginId: "seer", statePath: "/titles/state", requestPath: "/titles/request" };

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("le regroupement des états de titres", () => {
  it("pose UNE question pour toutes les cartes montées ensemble", async () => {
    const fetcher = vi.fn(async (url: string) => {
      expect(url).toContain("keys=movie%3A603%2Ctv%3A1399");
      return { items: { "movie:603": { badge: { label: "Demandé", tone: "info" } } } };
    });
    const a = loadTitleState(provider, "movie:603", "fr", fetcher);
    const b = loadTitleState(provider, "tv:1399", "fr", fetcher);
    const c = loadTitleState(provider, "movie:603", "fr", fetcher);
    await vi.advanceTimersByTimeAsync(20);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(await a).toEqual({ badge: { label: "Demandé", tone: "info" }, request: null });
    expect(await b).toBeNull();
    expect(await c).toEqual(await a);
  });

  it("découpe en paquets au-delà de la limite, et sépare les langues", async () => {
    const fetcher = vi.fn(async () => ({ items: {} }));
    const all = Array.from({ length: 61 }, (_, i) => loadTitleState(provider, `movie:${i + 1}` as const, "fr", fetcher));
    const en = loadTitleState(provider, "movie:1", "en", fetcher);
    await vi.advanceTimersByTimeAsync(20);
    await Promise.all([...all, en]);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("fait échouer les cartes du paquet quand le plugin ne répond pas", async () => {
    const fetcher = vi.fn(async () => { throw new Error("503"); });
    const a = loadTitleState(provider, "movie:603", "fr", fetcher);
    const settled = a.catch((err: Error) => err.message);
    await vi.advanceTimersByTimeAsync(20);
    expect(await settled).toBe("503");
  });
});
