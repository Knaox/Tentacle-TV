import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { entryId, type StoredEntry } from "../data/persist/octaveCachePolicy";
import { memoryBackend } from "../data/persist/octaveCacheStore";
import type { OctaveQueryClientLike } from "../data/persist/octaveCachePersister";
import { preloadOctaveCache } from "./octaveCacheBoot";
import { bootOctaveCache, isOctaveCacheHydrated, octaveCacheHydration, resetOctaveCacheHydration } from "./octaveCacheHydration";

/**
 * Octave — le cache gardé au DÉMARRAGE : lu pendant que le reste démarre,
 * rendu au cache de requêtes AVANT le premier rendu, pour l'identité seule.
 */

const OWNER = "|u1";
const HOME = ["music", "home"];
const key = JSON.stringify(HOME);
const entry = (owner: string, data: unknown): StoredEntry => ({ id: entryId(owner, key), key, owner, kind: "library", data, savedAt: Date.now() - 1_000, usedAt: Date.now(), bytes: 50 });
const client = () => new QueryClient({ defaultOptions: { queries: { retry: false } } }) as unknown as OctaveQueryClientLike & QueryClient;

afterEach(() => {
  resetOctaveCacheHydration(null);
  vi.unstubAllGlobals();
});

describe("démarrage en Octave", () => {
  it("les pages de l'identité sont dans le cache quand `bootOctaveCache` rend la main", async () => {
    vi.stubGlobal("localStorage", { getItem: (k: string) => (k === "tentacle_user" ? JSON.stringify({ Id: "u1" }) : null) });
    resetOctaveCacheHydration(memoryBackend([entry(OWNER, { recentlyPlayed: ["moi"] }), entry("|u2", { recentlyPlayed: ["autre"] })]));
    const qc = client();
    await bootOctaveCache(qc, Promise.resolve());
    expect(qc.getQueryData(HOME)).toEqual({ recentlyPlayed: ["moi"] });
    expect(isOctaveCacheHydrated(OWNER)).toBe(true);
  });

  it("une lecture déjà finie se rend de façon SYNCHRONE (avant tout rendu)", async () => {
    resetOctaveCacheHydration(memoryBackend([entry(OWNER, { recentlyPlayed: ["moi"] })]));
    await preloadOctaveCache();
    const qc = client();
    void octaveCacheHydration(qc, OWNER);
    expect(qc.getQueryData(HOME)).toEqual({ recentlyPlayed: ["moi"] });
  });

  it("une lecture encore en cours est reprise, sans relire le disque", async () => {
    const backend = memoryBackend([entry(OWNER, { recentlyPlayed: ["moi"] })]);
    const loadAll = vi.spyOn(backend, "loadAll");
    resetOctaveCacheHydration(backend);
    void preloadOctaveCache();
    const qc = client();
    await octaveCacheHydration(qc, OWNER);
    expect(qc.getQueryData(HOME)).toEqual({ recentlyPlayed: ["moi"] });
    expect(loadAll).toHaveBeenCalledTimes(1);
  });

  it("sans compte, rien n'est lu", async () => {
    vi.stubGlobal("localStorage", { getItem: () => null });
    const backend = memoryBackend([entry(OWNER, {})]);
    const loadAll = vi.spyOn(backend, "loadAll");
    resetOctaveCacheHydration(backend);
    await bootOctaveCache(client(), Promise.resolve());
    expect(loadAll).not.toHaveBeenCalled();
  });
});
