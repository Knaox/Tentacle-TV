/**
 * Une bascule qui passe par le proxy — cœur, « vu », Ma liste — retouche
 * aussitôt l'index de la reco : sans ça, le titre restait proposé le temps
 * du balayage (dix secondes au moins, un parcours complet de Jellyfin).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const patches: unknown[] = [];
const broadcasts: string[] = [];

vi.mock("../../services/reco/candidates/libraryMemo", () => ({
  patchLibraryMemo: (...args: unknown[]) => patches.push(args),
}));
vi.mock("../../services/wsManager", () => ({
  broadcastToUser: (userId: string, carousel: string) => broadcasts.push(`${userId} ${carousel}`),
}));
let usersInvalidated = 0;
vi.mock("../../services/watchTogether/usersCache", () => ({
  invalidateJellyfinUsers: () => { usersInvalidated += 1; },
}));

import { changesAccountPhoto, changesAccountState, emitProxyEvents, userDataPatchOf } from "./events";

beforeEach(() => {
  patches.length = 0;
  broadcasts.length = 0;
  usersInvalidated = 0;
});

describe("le drapeau posé par une requête du proxy", () => {
  it("cœur, « vu » et Ma liste — posés (POST) ou ôtés (DELETE)", () => {
    expect(userDataPatchOf("Users/u1/FavoriteItems/i1", "POST", {})).toEqual({ userId: "u1", itemId: "i1", patch: { isFavorite: true } });
    expect(userDataPatchOf("Users/u1/FavoriteItems/i1", "DELETE", {})).toEqual({ userId: "u1", itemId: "i1", patch: { isFavorite: false } });
    expect(userDataPatchOf("Users/u1/PlayedItems/i1", "POST", {})).toEqual({ userId: "u1", itemId: "i1", patch: { played: true } });
    expect(userDataPatchOf("Users/u1/Items/i1/Rating", "POST", { likes: "true" })).toEqual({ userId: "u1", itemId: "i1", patch: { inWatchlist: true } });
    expect(userDataPatchOf("Users/u1/Items/i1/Rating", "DELETE", {})).toEqual({ userId: "u1", itemId: "i1", patch: { inWatchlist: false } });
  });

  it("un « je n'aime pas » Jellyfin (likes=false) n'est pas Ma liste ; le reste ne dit rien", () => {
    expect(userDataPatchOf("Users/u1/Items/i1/Rating", "POST", { likes: "false" })?.patch).toEqual({ inWatchlist: false });
    expect(userDataPatchOf("Users/u1/Items/i1", "POST", {})).toBeNull();
    expect(userDataPatchOf("Users/u1/FavoriteItems/i1", "GET", {})).toBeNull();
    expect(userDataPatchOf("Sessions/Playing/Progress", "POST", {})).toBeNull();
  });

  it("la requête réussie retouche l'index du compte, et prévient ses écrans comme avant", () => {
    emitProxyEvents("Users/u1/FavoriteItems/i1", { method: "POST", query: {} });
    expect(patches).toEqual([["u1", "i1", { isFavorite: true }]]);
    expect(broadcasts).toEqual(["u1 watchlist"]);
  });
});

describe("l'écriture qui change l'état d'un titre (et vide les rangées en cache)", () => {
  it.each([
    ["POST", "Users/u1/FavoriteItems/i1"],
    ["DELETE", "Users/u1/FavoriteItems/i1"],
    ["POST", "Users/u1/PlayedItems/i1"],
    ["DELETE", "Users/u1/PlayedItems/i1"],
    ["POST", "Users/u1/Items/i1/Rating"],
    ["DELETE", "Users/u1/Items/i1/Rating"],
    ["POST", "Users/u1/Items/i1/UserData"],
  ])("%s %s : oui", (method, path) => {
    expect(changesAccountState(path, method)).toBe(true);
  });

  it.each([
    ["GET", "Users/u1/FavoriteItems/i1"],
    ["GET", "Users/u1/Items/Resume"],
    ["POST", "Sessions/Playing/Progress"],
    ["POST", "Items/i1"],
  ])("%s %s : non", (method, path) => {
    expect(changesAccountState(path, method)).toBe(false);
  });
});

describe("la photo d'un compte changée par le proxy", () => {
  it("fait relire la liste des comptes (son `imageTag`) à la requête suivante", () => {
    emitProxyEvents("Users/u1/Images/Primary", { method: "POST", query: {} });
    expect(usersInvalidated).toBe(1);
    expect(patches).toEqual([]);
    expect(broadcasts).toEqual([]);
  });

  it.each([
    ["POST", "Users/u1/Images/Primary", true],
    ["DELETE", "users/u1/images/primary", true],
    ["DELETE", "Users/u1/Images/Primary/0", true],
    ["GET", "Users/u1/Images/Primary", false],
    ["POST", "Items/i1/Images/Primary", false],
    ["POST", "Users/u1/Images/Backdrop", false],
  ])("%s %s : %s", (method, path, expected) => {
    expect(changesAccountPhoto(path, method)).toBe(expected);
  });
});
