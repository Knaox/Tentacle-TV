/**
 * La préparation des aperçus vue du client : la demande part en POST avec les
 * titres sous la forme du contrat ; les aperçus prêts de la réponse entrent
 * dans le cache des aperçus — sans écraser un aperçu qui vaut encore — ; un
 * refus ou une panne ne rend rien, sans exception.
 */
import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TrailerPreview } from "@tentacle-tv/shared";
import { trailerPreviewQueryKey } from "./trailerPreviewStream";
import { fetchTrailerPreviewWarm, seedTrailerPreviews, trailerPreviewCached, trailerPreviewSettled } from "./trailerPreviewWarm";

const ITEM = { kind: "item", itemId: "90d50b74d48412cfc9db9a256b1d0c64" } as const;
const TMDB = { kind: "tmdb", tmdbId: 603, mediaType: "movie" } as const;
const NOW = 1_800_000_000_000;

const preview = (path: string): TrailerPreview => ({
  ytId: "", source: { kind: "dailymotion", videoId: "x8e90ff" }, path, mimeType: "application/vnd.apple.mpegurl",
  expiresAt: NOW + 3_600_000, heights: [720], qualities: [],
});

afterEach(() => vi.unstubAllGlobals());

describe("préparation des aperçus › la demande", () => {
  it("part en POST, les titres sous la forme du contrat, AlloCiné compris", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      new Response(JSON.stringify({ ready: [{ subject: { tmdbId: 603, mediaType: "movie" }, preview: preview("/api/trailers/hls/dm%3Ax8e90ff/master.m3u8?t=a") }], queued: 1 })));
    vi.stubGlobal("fetch", fetchMock);
    const response = await fetchTrailerPreviewWarm([ITEM, TMDB], "fr");
    expect(response?.ready).toHaveLength(1);
    expect(response?.queued).toBe(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/api\/trailers\/preview\/warm$/);
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({
      subjects: [{ itemId: ITEM.itemId }, { tmdbId: 603, mediaType: "movie" }], lang: "fr", dailymotion: true,
    });
  });

  it("un refus ou une panne : rien, sans exception", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "rate_limited", retryAfterS: 2 }), { status: 429 })));
    expect(await fetchTrailerPreviewWarm([TMDB], "fr")).toBeNull();
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }));
    expect(await fetchTrailerPreviewWarm([TMDB], "fr")).toBeNull();
  });
});

describe("préparation des aperçus › le cache", () => {
  it("les aperçus prêts entrent dans le cache des aperçus : le survol n'a plus rien à demander", () => {
    const client = new QueryClient();
    seedTrailerPreviews(client, { ready: [{ subject: { tmdbId: 603, mediaType: "movie" }, preview: preview("/a") }], queued: 0 }, "fr", NOW);
    expect(client.getQueryData(trailerPreviewQueryKey(TMDB, "fr"))).toEqual({ status: "found", preview: preview("/a") });
    expect(client.getQueryState(trailerPreviewQueryKey(TMDB, "fr"))?.dataUpdatedAt).toBe(NOW);
    expect(trailerPreviewCached(client, TMDB, "fr", NOW)).toBe(true);
    expect(trailerPreviewCached(client, ITEM, "fr", NOW)).toBe(false);
  });

  it("n'écrase pas un aperçu qui vaut encore ; remplace un aperçu presque échu", () => {
    const client = new QueryClient();
    const key = trailerPreviewQueryKey(TMDB, "fr");
    client.setQueryData(key, { status: "found", preview: preview("/old") }, { updatedAt: NOW });
    seedTrailerPreviews(client, { ready: [{ subject: { tmdbId: 603, mediaType: "movie" }, preview: preview("/new") }], queued: 0 }, "fr", NOW + 1_000);
    expect(client.getQueryData<{ preview: TrailerPreview }>(key)?.preview.path).toBe("/old");
    // Une heure moins une minute plus tard, le jeton du relais est au bout : le neuf le remplace.
    const later = NOW + 3_600_000 - 2 * 60_000;
    seedTrailerPreviews(client, { ready: [{ subject: { tmdbId: 603, mediaType: "movie" }, preview: { ...preview("/new"), expiresAt: later + 3_600_000 } }], queued: 0 }, "fr", later);
    expect(client.getQueryData<{ preview: TrailerPreview }>(key)?.preview.path).toBe("/new");
  });

  it("rien à préparer : un aperçu en cache, ou un « pas de bande-annonce » qui vaut encore — jamais un refus passager", () => {
    const client = new QueryClient();
    client.setQueryData(trailerPreviewQueryKey(ITEM, "fr"), { status: "missing", reason: "no_trailer" }, { updatedAt: NOW });
    client.setQueryData(trailerPreviewQueryKey(TMDB, "fr"), { status: "missing", reason: "rate_limited", retryAfterMs: 2_000 }, { updatedAt: NOW });
    expect(trailerPreviewSettled(client, ITEM, "fr", NOW + 1_000)).toBe(true);
    expect(trailerPreviewSettled(client, ITEM, "fr", NOW + 2 * 3_600_000)).toBe(false);
    expect(trailerPreviewSettled(client, TMDB, "fr", NOW + 1_000)).toBe(false);
    seedTrailerPreviews(client, { ready: [{ subject: { tmdbId: 603, mediaType: "movie" }, preview: preview("/a") }], queued: 0 }, "fr", NOW);
    expect(trailerPreviewSettled(client, TMDB, "fr", NOW + 1_000)).toBe(true);
  });
});
