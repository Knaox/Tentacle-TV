/**
 * Le « J'aime » d'Affiner est le cœur de la bibliothèque. Le poser au
 * mauvais titre, c'est un cœur que l'utilisateur n'a jamais donné ; le
 * retirer à tort, c'est effacer un cœur qu'il avait posé lui-même. Éprouvés :
 * le titre là (cœur posé, index de la reco retouché, écrans prévenus), déjà
 * aimé (rien), absent ou Jellyfin muet (mis de côté jusqu'à l'arrivée),
 * l'annulation qui ne défait QUE ce que le like a fait, et chaque passage
 * d'un verdict à l'autre.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

interface Entry {
  key: string;
  itemId: string;
  isFavorite: boolean;
}
let index: { byKey: Map<string, Entry> } | null = null;
let jellyfinAccepts = true;
let databaseDown = false;
const calls: string[] = [];
const pending = new Set<string>();

vi.mock("../jellyfinLikes", () => ({
  favoriteItemForUser: async (userId: string, itemId: string) => {
    calls.push(`favorite ${userId} ${itemId}`);
    return jellyfinAccepts;
  },
  unfavoriteItemForUser: async (userId: string, itemId: string) => {
    calls.push(`unfavorite ${userId} ${itemId}`);
    return jellyfinAccepts;
  },
}));
vi.mock("../reco/candidates/libraryMemo", () => ({
  getLibraryIndexMemo: async () => {
    if (!index) throw new Error("Jellyfin muet");
    return index;
  },
  patchLibraryMemo: (userId: string, key: string, patch: Partial<Entry>) => {
    calls.push(`memo ${userId} ${key} ${JSON.stringify(patch)}`);
    const entry = index?.byKey.get(key);
    if (entry) Object.assign(entry, patch);
    return entry ?? null;
  },
}));
vi.mock("../watchlistPending", () => ({
  holdPendingFlag: async (userId: string, mediaType: string, tmdbId: number, flag: string) => {
    if (databaseDown) throw new Error("base injoignable");
    calls.push(`hold ${userId} ${mediaType}:${tmdbId} ${flag}`);
    pending.add(`${userId}|${mediaType}:${tmdbId}|${flag}`);
  },
  dropPendingFlag: async (userId: string, mediaType: string, tmdbId: number, flag: string) => {
    const had = pending.delete(`${userId}|${mediaType}:${tmdbId}|${flag}`);
    if (had) calls.push(`drop ${userId} ${mediaType}:${tmdbId} ${flag}`);
    return had;
  },
}));
vi.mock("../wsManager", () => ({
  broadcastToUser: (userId: string, carousel: string) => calls.push(`broadcast ${userId} ${carousel}`),
}));

import {
  favoriteForSwipe,
  isLikeVerdict,
  resetSwipeFavoritesForTests,
  syncSwipeFavorite,
  unfavoriteForSwipe,
} from "./swipeFavorites";

function library(...entries: Array<[string, string, boolean]>) {
  index = { byKey: new Map(entries.map(([key, itemId, isFavorite]) => [key, { key, itemId, isFavorite }])) };
}

beforeEach(() => {
  index = null;
  jellyfinAccepts = true;
  databaseDown = false;
  calls.length = 0;
  pending.clear();
  resetSwipeFavoritesForTests();
});

describe("un like d'Affiner", () => {
  it("pose le cœur d'un titre de la bibliothèque, retouche l'index de la reco, prévient les écrans", async () => {
    library(["movie:603", "m1", false]);
    expect(await favoriteForSwipe("u1", "movie", 603)).toBe("favorited");
    expect(calls).toEqual(["favorite u1 m1", 'memo u1 movie:603 {"isFavorite":true}', "broadcast u1 favorites"]);
  });

  it("ne touche à rien quand le cœur y est déjà", async () => {
    library(["tv:1399", "s1", true]);
    expect(await favoriteForSwipe("u1", "tv", 1399)).toBe("already");
    expect(calls).toEqual([]);
  });

  it("met le cœur de côté pour un titre absent : il sera posé à l'arrivée", async () => {
    library(["movie:603", "m1", false]);
    expect(await favoriteForSwipe("u1", "tv", 42)).toBe("pending");
    expect(calls).toEqual(["hold u1 tv:42 favorite"]);
  });

  it("met aussi de côté quand l'index manque ou que Jellyfin refuse — le balayage réessaiera", async () => {
    expect(await favoriteForSwipe("u1", "movie", 603)).toBe("pending");
    library(["movie:603", "m1", false]);
    jellyfinAccepts = false;
    expect(await favoriteForSwipe("u2", "movie", 603)).toBe("pending");
    expect(calls).toEqual(["hold u1 movie:603 favorite", "favorite u2 m1", "hold u2 movie:603 favorite"]);
  });
});

describe("l'annulation", () => {
  it("retire le cœur que le like a posé", async () => {
    library(["movie:603", "m1", false]);
    await favoriteForSwipe("u1", "movie", 603);
    calls.length = 0;
    await unfavoriteForSwipe("u1", "movie", 603);
    expect(calls).toEqual(["unfavorite u1 m1", 'memo u1 movie:603 {"isFavorite":false}', "broadcast u1 favorites"]);
  });

  it("garde un cœur qui existait AVANT le like", async () => {
    library(["movie:603", "m1", true]);
    await favoriteForSwipe("u1", "movie", 603);
    await unfavoriteForSwipe("u1", "movie", 603);
    expect(calls).toEqual([]);
  });

  it("efface le cœur mis de côté, sans appeler Jellyfin", async () => {
    await favoriteForSwipe("u1", "tv", 42);
    calls.length = 0;
    await unfavoriteForSwipe("u1", "tv", 42);
    expect(calls).toEqual(["drop u1 tv:42 favorite"]);
  });

  it("ne défait que le compte qui a aimé", async () => {
    library(["movie:603", "m1", false]);
    await favoriteForSwipe("u1", "movie", 603);
    calls.length = 0;
    await unfavoriteForSwipe("u2", "movie", 603);
    expect(calls).toEqual([]);
  });
});

describe("d'un verdict à l'autre", () => {
  it("like et coup de cœur sont un j'aime ; refus et « passer » n'en sont pas", () => {
    expect([isLikeVerdict("like"), isLikeVerdict("superlike")]).toEqual([true, true]);
    expect([isLikeVerdict("dislike"), isLikeVerdict("skip"), isLikeVerdict(null)]).toEqual([false, false, false]);
  });

  it("pose au premier like, ne bouge pas du like au coup de cœur, défait au refus", async () => {
    library(["movie:603", "m1", false]);
    await syncSwipeFavorite("u1", "movie", 603, null, "like");
    await syncSwipeFavorite("u1", "movie", 603, "like", "superlike");
    await syncSwipeFavorite("u1", "movie", 603, "superlike", "dislike");
    expect(calls.filter((c) => !c.startsWith("memo") && !c.startsWith("broadcast"))).toEqual([
      "favorite u1 m1",
      "unfavorite u1 m1",
    ]);
  });

  it("un refus ou un « passer » seuls ne touchent pas au cœur", async () => {
    library(["movie:603", "m1", false]);
    await syncSwipeFavorite("u1", "movie", 603, null, "dislike");
    await syncSwipeFavorite("u1", "movie", 603, "dislike", "skip");
    expect(calls).toEqual([]);
  });

  it("ne lève jamais : le verdict est déjà enregistré", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    databaseDown = true;
    await expect(syncSwipeFavorite("u1", "movie", 603, null, "like")).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledTimes(1);
    error.mockRestore();
  });
});
