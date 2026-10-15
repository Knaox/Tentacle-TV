/**
 * Un changement de politique se voit dès la relecture suivante de la politique
 * (30 s au plus) : le relevé de ce que voit le compte est refait sur-le-champ,
 * au lieu de servir l'ancien jusqu'à dix minutes.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ maxRating: 18 as number | null, readable: true, fetches: 0, items: ["a", "b"] }));
vi.mock("../contentPolicy", () => ({
  getContentPolicy: async (userId: string) => ({
    userId, readable: h.readable, restricted: h.maxRating !== null, maxParentalRating: h.maxRating,
    maxParentalSubRating: null, blockUnratedItems: [], blockedTags: [], allowedTags: [], enableAllFolders: true,
    enabledFolders: [], blockedMediaFolders: [], accessSchedules: [],
  }),
}));
vi.mock("../configStore", () => ({ getJellyfinUrl: () => "http://jf.test", getJellyfinApiKey: () => "cle" }));

import { getUserAccess, resetUserAccessForTests } from "../search/userAccess";
import { policyChanged, policyEpoch, resetPolicyWatchForTests } from "./policyWatch";

beforeEach(() => {
  resetUserAccessForTests();
  resetPolicyWatchForTests();
  h.maxRating = 18;
  h.readable = true;
  h.fetches = 0;
  h.items = ["a", "b"];
  vi.stubGlobal("fetch", async () => {
    h.fetches++;
    return new Response(JSON.stringify({ Items: h.items.map((Id) => ({ Id })), TotalRecordCount: h.items.length }), { status: 200 });
  });
});

describe("policyChanged", () => {
  it("première vue : rien à comparer ; même politique : non ; politique changée : oui", async () => {
    expect(await policyChanged("enfant")).toBe(false);
    expect(await policyChanged("enfant")).toBe(false);
    expect(policyEpoch("enfant")).toBe(0);
    h.maxRating = 10;
    expect(await policyChanged("enfant")).toBe(true);
    expect(await policyChanged("enfant")).toBe(false);
    // Une clé de cache qui porte l'époque se périme au changement.
    expect(policyEpoch("enfant")).toBe(1);
  });

  it("une politique illisible (Jellyfin muet) ne jette rien", async () => {
    await policyChanged("enfant");
    h.readable = false;
    h.maxRating = 10;
    expect(await policyChanged("enfant")).toBe(false);
  });
});

describe("getUserAccess suit la politique", () => {
  it("politique durcie : le relevé est refait tout de suite, le titre interdit n'y est plus", async () => {
    expect([...(await getUserAccess("enfant"))!.items.keys()]).toEqual(["a", "b"]);
    await getUserAccess("enfant");
    expect(h.fetches).toBe(1);
    h.maxRating = 10;
    h.items = ["a"];
    expect([...(await getUserAccess("enfant"))!.items.keys()]).toEqual(["a"]);
    expect(h.fetches).toBe(2);
  });
});
