/**
 * Le retrait automatique de « Ma liste » touche à ce que l'utilisateur a
 * choisi de suivre : se tromper, c'est faire disparaître une série qu'il
 * attendait. Les cas éprouvés : la série entièrement vue (diffusion en cours
 * comprise), celle qui a encore un épisode devant elle, celle qui n'est pas
 * dans la liste, et le réseau qui échoue.
 */

import { QueryClient } from "@tanstack/react-query";
import type { MediaItem } from "@tentacle-tv/shared";
import { TICKS_PER_SECOND } from "@tentacle-tv/shared";
import { describe, expect, it } from "vitest";
import { WATCHLIST_SERIES_IDS_KEY, retireSeriesFromWatchlistIfFullyWatched, stoppedPastHalf } from "./watchlistEffects";
import { AUTO_RETIRED_PATH, type BackendFetcher } from "./watchlistAutoRetired";

interface Call {
  path: string;
  init?: { method?: string };
}

/** Un client Jellyfin qui note ce qu'on lui demande et réussit ou échoue à la demande. */
function fakeClient(deleteFails = false): { calls: Call[]; fetch: (path: string, init?: { method?: string }) => Promise<unknown> } {
  const calls: Call[] = [];
  return {
    calls,
    fetch(path, init) {
      calls.push({ path, init });
      return deleteFails ? Promise.reject(new Error("réseau")) : Promise.resolve(undefined);
    },
  };
}

/** Un backend Tentacle qui note ce qu'on lui confie, ou qui est injoignable. */
function fakeBackend(fails = false): BackendFetcher & { calls: Array<{ path: string; init?: RequestInit }> } {
  const calls: Array<{ path: string; init?: RequestInit }> = [];
  return {
    calls,
    fetch<T>(path: string, init?: RequestInit): Promise<T> {
      calls.push({ path, init });
      return fails ? Promise.reject(new Error("backend")) : Promise.resolve(undefined as T);
    },
  };
}

function seriesItem(likes: boolean): MediaItem {
  return {
    Id: "s1",
    Name: "Série",
    Type: "Series",
    Status: "Continuing",
    UserData: { Likes: likes, Played: false, PlaybackPositionTicks: 0 },
  } as unknown as MediaItem;
}

/** Un cache où la série s1 est terminée, likée, et encore en diffusion. */
function seededCache(opts?: { state?: "completed" | "next"; liked?: boolean }): QueryClient {
  const qc = new QueryClient();
  const state = opts?.state ?? "completed";
  const liked = opts?.liked ?? true;
  qc.setQueryData(["series-watch-state", "s1"], state === "completed" ? { type: "completed" } : { type: "next", episode: {} });
  qc.setQueryData(WATCHLIST_SERIES_IDS_KEY, liked ? ["s1", "s2"] : ["s2"]);
  qc.setQueryData(["item", "s1"], seriesItem(liked));
  return qc;
}

describe("le retrait automatique d'une série entièrement vue", () => {
  it("retire une série terminée même si elle est encore en diffusion, et patche le cache", async () => {
    const qc = seededCache();
    const client = fakeClient();

    expect(await retireSeriesFromWatchlistIfFullyWatched(qc, client, "u1", "s1")).toBe(true);

    expect(client.calls).toEqual([{ path: "/Users/u1/Items/s1/Rating", init: { method: "DELETE" } }]);
    expect(qc.getQueryData<string[]>(WATCHLIST_SERIES_IDS_KEY)).toEqual(["s2"]);
    expect(qc.getQueryData<MediaItem>(["item", "s1"])?.UserData?.Likes).toBe(false);
  });

  it("ne touche à rien tant qu'il reste un épisode à voir", async () => {
    const qc = seededCache({ state: "next" });
    const client = fakeClient();

    expect(await retireSeriesFromWatchlistIfFullyWatched(qc, client, "u1", "s1")).toBe(false);
    expect(client.calls).toHaveLength(0);
    expect(qc.getQueryData<string[]>(WATCHLIST_SERIES_IDS_KEY)).toEqual(["s1", "s2"]);
  });

  it("ne touche à rien si la série n'est pas dans Ma liste", async () => {
    const qc = seededCache({ liked: false });
    const client = fakeClient();

    expect(await retireSeriesFromWatchlistIfFullyWatched(qc, client, "u1", "s1")).toBe(false);
    expect(client.calls).toHaveLength(0);
  });

  it("laisse le cache intact quand le retrait serveur échoue", async () => {
    const qc = seededCache();
    const client = fakeClient(true);

    expect(await retireSeriesFromWatchlistIfFullyWatched(qc, client, "u1", "s1")).toBe(false);
    expect(client.calls).toHaveLength(1);
    expect(qc.getQueryData<string[]>(WATCHLIST_SERIES_IDS_KEY)).toEqual(["s1", "s2"]);
    expect(qc.getQueryData<MediaItem>(["item", "s1"])?.UserData?.Likes).toBe(true);
  });

  it("mémorise le retrait côté serveur, après le retrait réussi", async () => {
    const qc = seededCache();
    const backend = fakeBackend();

    await retireSeriesFromWatchlistIfFullyWatched(qc, fakeClient(), "u1", "s1", backend);

    expect(backend.calls).toEqual([
      { path: AUTO_RETIRED_PATH, init: { method: "PUT", body: '{"seriesId":"s1"}' } },
    ]);
  });

  it("ne mémorise rien si le retrait serveur a échoué", async () => {
    const backend = fakeBackend();
    await retireSeriesFromWatchlistIfFullyWatched(seededCache(), fakeClient(true), "u1", "s1", backend);
    expect(backend.calls).toHaveLength(0);
  });

  it("retire quand même si le backend Tentacle est injoignable", async () => {
    const qc = seededCache();
    expect(await retireSeriesFromWatchlistIfFullyWatched(qc, fakeClient(), "u1", "s1", fakeBackend(true))).toBe(true);
    expect(qc.getQueryData<string[]>(WATCHLIST_SERIES_IDS_KEY)).toEqual(["s2"]);
  });

  it("ne fait rien sans utilisateur ou sans série", async () => {
    const qc = seededCache();
    const client = fakeClient();

    expect(await retireSeriesFromWatchlistIfFullyWatched(qc, client, null, "s1")).toBe(false);
    expect(await retireSeriesFromWatchlistIfFullyWatched(qc, client, "u1", undefined)).toBe(false);
    expect(client.calls).toHaveLength(0);
  });
});

describe("la position d'arrêt qui vaut « lu jusqu'au bout »", () => {
  const runtime = 3600 * TICKS_PER_SECOND; // une heure

  it("reste sans avis quand la position ou la durée manque", () => {
    expect(stoppedPastHalf(undefined, runtime)).toBeNull();
    expect(stoppedPastHalf(1800, undefined)).toBeNull();
    expect(stoppedPastHalf(1800, 0)).toBeNull();
  });

  it("refuse un arrêt dans la première moitié", () => {
    expect(stoppedPastHalf(0, runtime)).toBe(false);
    expect(stoppedPastHalf(1764, runtime)).toBe(false); // 49 %
  });

  it("accepte dès la moitié", () => {
    expect(stoppedPastHalf(1800, runtime)).toBe(true);
    expect(stoppedPastHalf(3420, runtime)).toBe(true); // 95 %
  });
});
