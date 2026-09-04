/**
 * Le retrait automatique de « Ma liste » touche à ce que l'utilisateur a
 * choisi de suivre : se tromper, c'est faire disparaître une série qu'il
 * attendait. Les cas éprouvés : la série entièrement vue (diffusion en cours
 * comprise), celle dont aucune fiche n'a mis l'état en cache, celle qui a
 * encore un épisode devant elle, celle qui n'est pas dans la liste — ou dont
 * on ne sait rien —, et le réseau qui échoue.
 */

import { QueryClient } from "@tanstack/react-query";
import type { MediaItem } from "@tentacle-tv/shared";
import { TICKS_PER_SECOND } from "@tentacle-tv/shared";
import { describe, expect, it } from "vitest";
import {
  WATCHLIST_SERIES_IDS_KEY, resetWatchedIfFullyWatchedOnAdd, retireSeriesFromWatchlistIfFullyWatched, stoppedPastHalf,
} from "./watchlistEffects";
import { AUTO_RETIRED_PATH, type BackendFetcher } from "./watchlistAutoRetired";

interface Call {
  path: string;
  init?: { method?: string };
}

const STATE_KEY = ["series-watch-state", "s1"];
const EPISODES_PATH = `/Shows/s1/Episodes?${new URLSearchParams({
  userId: "u1", fields: "Overview,PrimaryImageAspectRatio", enableUserData: "true",
})}`;
const SERIES_PATH = "/Users/u1/Items/s1?EnableUserData=true";
const RATING_PATH = "/Users/u1/Items/s1/Rating";

type Answer = (path: string) => unknown;

/**
 * Un client Jellyfin qui note ce qu'on lui demande. Les GET sont servis par
 * `answer` — sans elle, une réponse sans forme, que le calcul d'état refuse.
 */
function fakeClient(deleteFails = false, answer?: Answer) {
  const calls: Call[] = [];
  return {
    calls,
    fetch(path: string, init?: { method?: string }): Promise<unknown> {
      calls.push({ path, init });
      if (init?.method === "DELETE") {
        return deleteFails ? Promise.reject(new Error("réseau")) : Promise.resolve(undefined);
      }
      return Promise.resolve(answer?.(path));
    },
  };
}

const gets = (client: { calls: Call[] }) => client.calls.filter((c) => !c.init?.method).map((c) => c.path);
const deletes = (client: { calls: Call[] }) =>
  client.calls.filter((c) => c.init?.method === "DELETE").map((c) => c.path);

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

function episode(index: number, played: boolean): MediaItem {
  return {
    Id: `e${index}`, Type: "Episode", ParentIndexNumber: 1, IndexNumber: index,
    UserData: {
      Played: played, PlaybackPositionTicks: 0,
      LastPlayedDate: played ? `2026-09-0${index}T20:00:00Z` : undefined,
    },
  } as unknown as MediaItem;
}

/** Le serveur : deux épisodes, tous vus — ou le second encore à voir. */
function episodes(allPlayed: boolean, extra?: Answer): Answer {
  return (path) => (path === EPISODES_PATH ? { Items: [episode(1, true), episode(2, allPlayed)] } : extra?.(path));
}

/**
 * Un cache où la série s1 est likée et, sauf demande contraire, terminée.
 * `state: "absent"` : aucune fiche n'a mis l'état en cache ;
 * `liked: "unknown"` : ni le Set ni l'item ne sont en cache.
 */
function seededCache(opts?: { state?: "completed" | "next" | "absent"; liked?: boolean | "unknown" }): QueryClient {
  const qc = new QueryClient();
  const state = opts?.state ?? "completed";
  const liked = opts?.liked ?? true;
  if (state !== "absent") {
    qc.setQueryData(STATE_KEY, state === "completed" ? { type: "completed" } : { type: "next", episode: {} });
  }
  if (liked !== "unknown") {
    qc.setQueryData(WATCHLIST_SERIES_IDS_KEY, liked ? ["s1", "s2"] : ["s2"]);
    qc.setQueryData(["item", "s1"], seriesItem(liked));
  }
  return qc;
}

describe("le retrait automatique d'une série entièrement vue", () => {
  it("retire une série terminée même si elle est encore en diffusion, et patche le cache", async () => {
    const qc = seededCache();
    const client = fakeClient(false, episodes(true));

    expect(await retireSeriesFromWatchlistIfFullyWatched(qc, client, "u1", "s1")).toBe(true);

    expect(gets(client)).toEqual([EPISODES_PATH]);
    expect(deletes(client)).toEqual([RATING_PATH]);
    expect(qc.getQueryData<string[]>(WATCHLIST_SERIES_IDS_KEY)).toEqual(["s2"]);
    expect(qc.getQueryData<MediaItem>(["item", "s1"])?.UserData?.Likes).toBe(false);
  });

  it("va chercher l'état quand aucune fiche ne l'a mis en cache, et le laisse au cache", async () => {
    const qc = seededCache({ state: "absent" });
    const client = fakeClient(false, episodes(true));

    expect(await retireSeriesFromWatchlistIfFullyWatched(qc, client, "u1", "s1")).toBe(true);

    expect(deletes(client)).toEqual([RATING_PATH]);
    expect(qc.getQueryData(STATE_KEY)).toEqual({ type: "completed" });
  });

  it("croit le serveur, pas le cache : un état périmé ne décide rien", async () => {
    // La fiche disait « un épisode à voir » — il vient d'être regardé.
    const stale = seededCache({ state: "next" });
    expect(await retireSeriesFromWatchlistIfFullyWatched(stale, fakeClient(false, episodes(true)), "u1", "s1")).toBe(true);

    // La fiche disait « terminée » — un épisode est arrivé depuis.
    const outdated = seededCache();
    const client = fakeClient(false, episodes(false));
    expect(await retireSeriesFromWatchlistIfFullyWatched(outdated, client, "u1", "s1")).toBe(false);
    expect(deletes(client)).toHaveLength(0);
    expect(outdated.getQueryData(STATE_KEY)).toMatchObject({ type: "next" });
  });

  it("ne touche à rien tant qu'il reste un épisode à voir", async () => {
    const qc = seededCache({ state: "next" });
    const client = fakeClient(false, episodes(false));

    expect(await retireSeriesFromWatchlistIfFullyWatched(qc, client, "u1", "s1")).toBe(false);
    expect(deletes(client)).toHaveLength(0);
    expect(qc.getQueryData<string[]>(WATCHLIST_SERIES_IDS_KEY)).toEqual(["s1", "s2"]);
  });

  it("s'en remet à l'état en cache quand le serveur ne répond pas — et à rien sans cache", async () => {
    const cached = seededCache();
    expect(await retireSeriesFromWatchlistIfFullyWatched(cached, fakeClient(), "u1", "s1")).toBe(true);

    const bare = seededCache({ state: "absent" });
    const client = fakeClient();
    expect(await retireSeriesFromWatchlistIfFullyWatched(bare, client, "u1", "s1")).toBe(false);
    expect(deletes(client)).toHaveLength(0);
  });

  it("ne touche à rien si la série n'est pas dans Ma liste", async () => {
    const qc = seededCache({ liked: false });
    const client = fakeClient(false, episodes(true));

    expect(await retireSeriesFromWatchlistIfFullyWatched(qc, client, "u1", "s1")).toBe(false);
    expect(deletes(client)).toHaveLength(0);
    // Le Set a répondu : pas de détour par le serveur.
    expect(gets(client)).toEqual([EPISODES_PATH]);
  });

  it("demande l'item au serveur quand rien ne dit si la série est dans Ma liste", async () => {
    const liked = seededCache({ liked: "unknown" });
    const client = fakeClient(false, episodes(true, (path) => (path === SERIES_PATH ? seriesItem(true) : undefined)));
    expect(await retireSeriesFromWatchlistIfFullyWatched(liked, client, "u1", "s1")).toBe(true);
    expect(gets(client)).toEqual([EPISODES_PATH, SERIES_PATH]);
    expect(deletes(client)).toEqual([RATING_PATH]);
    // L'item demandé n'entre pas dans le cache : la fiche y attend plus de champs.
    expect(liked.getQueryData(["item", "s1"])).toBeUndefined();

    const notLiked = seededCache({ liked: "unknown" });
    const quiet = fakeClient(false, episodes(true, (path) => (path === SERIES_PATH ? seriesItem(false) : undefined)));
    expect(await retireSeriesFromWatchlistIfFullyWatched(notLiked, quiet, "u1", "s1")).toBe(false);
    expect(deletes(quiet)).toHaveLength(0);
  });

  it("laisse le cache intact quand le retrait serveur échoue", async () => {
    const qc = seededCache();
    const client = fakeClient(true, episodes(true));

    expect(await retireSeriesFromWatchlistIfFullyWatched(qc, client, "u1", "s1")).toBe(false);
    expect(deletes(client)).toHaveLength(1);
    expect(qc.getQueryData<string[]>(WATCHLIST_SERIES_IDS_KEY)).toEqual(["s1", "s2"]);
    expect(qc.getQueryData<MediaItem>(["item", "s1"])?.UserData?.Likes).toBe(true);
  });

  it("mémorise le retrait côté serveur, après le retrait réussi", async () => {
    const backend = fakeBackend();
    await retireSeriesFromWatchlistIfFullyWatched(seededCache(), fakeClient(false, episodes(true)), "u1", "s1", backend);
    expect(backend.calls).toEqual([
      { path: AUTO_RETIRED_PATH, init: { method: "PUT", body: '{"seriesId":"s1"}' } },
    ]);
  });

  it("ne mémorise rien si le retrait serveur a échoué", async () => {
    const backend = fakeBackend();
    await retireSeriesFromWatchlistIfFullyWatched(seededCache(), fakeClient(true, episodes(true)), "u1", "s1", backend);
    expect(backend.calls).toHaveLength(0);
  });

  it("retire quand même si le backend Tentacle est injoignable", async () => {
    const qc = seededCache();
    const client = fakeClient(false, episodes(true));
    expect(await retireSeriesFromWatchlistIfFullyWatched(qc, client, "u1", "s1", fakeBackend(true))).toBe(true);
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

describe("la remise à zéro d'une série entièrement vue qu'on ajoute à Ma liste", () => {
  it("va chercher l'état quand aucune fiche ne l'a mis en cache", async () => {
    const qc = seededCache({ state: "absent" });
    const client = fakeClient(false, episodes(true));

    await resetWatchedIfFullyWatchedOnAdd(qc, client, "u1", "s1", "s1");

    expect(deletes(client)).toEqual(["/Users/u1/PlayedItems/s1"]);
  });

  it("laisse une série entamée là où elle en est", async () => {
    const qc = seededCache({ state: "absent" });
    const client = fakeClient(false, episodes(false));

    await resetWatchedIfFullyWatchedOnAdd(qc, client, "u1", "s1", "s1");

    expect(deletes(client)).toHaveLength(0);
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
