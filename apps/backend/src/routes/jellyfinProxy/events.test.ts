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

import { emitProxyEvents, userDataPatchOf } from "./events";

beforeEach(() => {
  patches.length = 0;
  broadcasts.length = 0;
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
