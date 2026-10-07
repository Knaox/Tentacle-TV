import { beforeEach, describe, expect, it, vi } from "vitest";

const calls = vi.hoisted(() => ({
  all: vi.fn(),
  user: vi.fn(),
  added: vi.fn(),
  catalog: vi.fn(),
  access: vi.fn(),
  memo: vi.fn(),
  profile: vi.fn(),
  userAccess: vi.fn(),
}));
vi.mock("./wsManager", () => ({ broadcastAll: calls.all, broadcastToUser: calls.user }));
vi.mock("./libraryAddedNotifier", () => ({ poke: calls.added }));
vi.mock("./search/catalog", () => ({ markCatalogChanged: calls.catalog }));
vi.mock("./search/userAccess", () => ({ markAllUserAccessStale: calls.access, refreshUserAccess: calls.userAccess }));
vi.mock("./reco/candidates/libraryMemo", () => ({ refreshLibraryMemo: calls.memo }));
vi.mock("./reco/jobs", () => ({ pokeProfile: calls.profile }));

import { relayLibraryChanged, relayUserDataChanged, resetJellyfinUserEventsForTests } from "./jellyfinUserEvents";

const ADDED = { ItemsAdded: ["film"], ItemsUpdated: [], ItemsRemoved: [] };

beforeEach(() => {
  resetJellyfinUserEventsForTests();
  for (const fn of Object.values(calls)) fn.mockClear();
  vi.spyOn(console, "log").mockImplementation(() => undefined);
});

describe("relayLibraryChanged", () => {
  it("un ajout : les rangées « Derniers ajouts » de tous les comptes, les notifications et la recherche", () => {
    relayLibraryChanged(ADDED, 10_000);
    expect(calls.all).toHaveBeenCalledWith("recently_added");
    expect(calls.all).toHaveBeenCalledTimes(1);
    expect(calls.added).toHaveBeenCalledTimes(1);
    expect(calls.catalog).toHaveBeenCalledTimes(1);
    expect(calls.access).toHaveBeenCalledTimes(1);
  });

  it("jamais la bannière : c'est un tirage au hasard, elle changerait sous les yeux", () => {
    relayLibraryChanged(ADDED, 10_000);
    expect(calls.all).not.toHaveBeenCalledWith("featured");
  });

  it("trois appareils connectés reçoivent le même évènement : relayé une fois", () => {
    relayLibraryChanged(ADDED, 10_000);
    relayLibraryChanged(ADDED, 10_005);
    relayLibraryChanged(ADDED, 10_020);
    expect(calls.all).toHaveBeenCalledTimes(1);
    relayLibraryChanged(ADDED, 15_000); // l'ajout suivant, lui, passe
    expect(calls.all).toHaveBeenCalledTimes(2);
  });
});

describe("relayUserDataChanged", () => {
  it("« vu » ou favori d'un compte : SES rangées seulement", () => {
    relayUserDataChanged({ UserId: "u1", UserDataList: [] }, 10_000);
    expect(calls.user.mock.calls.map(([user, carousel]) => `${user}:${carousel}`)).toEqual([
      "u1:watched", "u1:watchlist", "u1:favorites", "u1:continue_watching",
    ]);
    expect(calls.all).not.toHaveBeenCalled();
    expect(calls.profile).toHaveBeenCalledWith("u1");
  });

  it("dédoublonné par compte, pas entre comptes", () => {
    relayUserDataChanged({ UserId: "u1" }, 10_000);
    relayUserDataChanged({ UserId: "u1" }, 10_010);
    relayUserDataChanged({ UserId: "u2" }, 10_010);
    expect(calls.profile.mock.calls).toEqual([["u1"], ["u2"]]);
  });

  it("sans compte dans l'évènement : rien", () => {
    relayUserDataChanged({}, 10_000);
    relayUserDataChanged(null, 10_000);
    expect(calls.user).not.toHaveBeenCalled();
  });
});
