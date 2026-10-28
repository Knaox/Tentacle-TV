import { afterEach, describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { memoryBackend } from "./octaveCacheBackend";
import { entryId, type StoredEntry } from "./octaveCachePolicy";
import type { OctaveQueryClientLike } from "./octaveCachePersister";
import { bootOctaveCacheFor, configureOctaveCacheBackend, isOctaveCacheHydrated, octaveCacheBackend, resetOctaveCacheHydration } from "./octaveCacheRuntime";

const OWNER = "http://srv|user-1";
const KEY = ["music", "home"];

function entry(owner: string, data: unknown): StoredEntry {
  const key = JSON.stringify(KEY);
  const now = Date.now();
  return { id: entryId(owner, key), key, owner, kind: "library", data, savedAt: now, usedAt: now, bytes: 10 };
}

afterEach(() => resetOctaveCacheHydration(null));

describe("le cache gardé au démarrage, stockage branché par la plateforme", () => {
  it("le stockage de la plateforme sert dès qu'aucun autre n'est imposé", async () => {
    const platform = memoryBackend([entry(OWNER, { rows: 1 })]);
    configureOctaveCacheBackend(() => platform);
    resetOctaveCacheHydration(null);
    expect(octaveCacheBackend()).toBe(platform);
  });

  it("les pages de l'identité reviennent AVANT le premier rendu, jamais celles d'une autre", async () => {
    resetOctaveCacheHydration(memoryBackend([entry(OWNER, { rows: 1 }), entry("http://srv|other", { rows: 2 })]));
    const qc = new QueryClient();
    await bootOctaveCacheFor(qc as unknown as OctaveQueryClientLike, OWNER);
    expect(qc.getQueryData(KEY)).toEqual({ rows: 1 });
    expect(isOctaveCacheHydrated(OWNER)).toBe(true);
  });

  it("sans identité : rien de lu, rien de rendu", async () => {
    resetOctaveCacheHydration(memoryBackend([entry(OWNER, { rows: 1 })]));
    const qc = new QueryClient();
    await bootOctaveCacheFor(qc as unknown as OctaveQueryClientLike, null);
    expect(qc.getQueryData(KEY)).toBeUndefined();
  });
});
