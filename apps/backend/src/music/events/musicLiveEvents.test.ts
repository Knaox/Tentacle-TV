/**
 * Ce que les sockets des comptes disent de la musique, relayé : une fois par
 * évènement (plusieurs appareils le reçoivent), à qui le VOIT seulement.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MusicAccess } from "../access/musicAccess";
import type { IncrementalResult } from "../index/indexSync";
import type { IndexRow } from "../index/indexTypes";
import { onJellyfinLibraryChanged, onJellyfinUserDataChanged, resetMusicLiveEventsForTests, tellListPrefsChanged } from "./musicLiveEvents";

const { sent, accessOf, apply, known, playlistsOf } = vi.hoisted(() => ({
  sent: [] as { userId: string; msg: unknown }[],
  accessOf: new Map<string, MusicAccess>(),
  apply: vi.fn<(...args: string[][]) => Promise<IncrementalResult | null>>(),
  known: new Set<string>(),
  playlistsOf: new Map<string, string[]>(),
}));

vi.mock("../../services/wsManager", () => ({
  connectedUserIds: () => [...accessOf.keys()],
  sendToUser: (userId: string, msg: unknown) => sent.push({ userId, msg }),
}));
vi.mock("../access/musicAccess", async (original) => ({
  ...(await original<typeof import("../access/musicAccess")>()),
  getMusicAccess: async (userId: string) => accessOf.get(userId) ?? { mode: "none" },
}));
vi.mock("../index/indexSync", () => ({ syncState: () => ({ ready: true }), applyLibraryChange: (...a: string[][]) => apply(...a) }));
vi.mock("../index/indexQueries", () => ({
  rowsByIds: async (ids: string[]) => new Map(ids.filter((id) => known.has(id)).map((id) => [id, { id }])),
}));
vi.mock("../playlists/playlistJellyfin", () => ({
  forgetUserPlaylists: () => undefined,
  listUserPlaylists: async (userId: string) => (playlistsOf.get(userId) ?? []).map((Id) => ({ Id })),
}));

const track = (id: string) => ({ id, recordingMbid: null }) as unknown as IndexRow;
const empty: IncrementalResult = { added: [], updated: [], removed: [], addedRefs: [], updatedRefs: [], playlists: [], unresolved: [] };

beforeEach(() => {
  sent.length = 0;
  accessOf.clear();
  known.clear();
  playlistsOf.clear();
  apply.mockReset();
  resetMusicLiveEventsForTests();
});

describe("évènements de bibliothèque", () => {
  it("un ajout : chaque compte apprend ce qu'il voit, et rien s'il ne voit pas la musique", async () => {
    accessOf.set("all", { mode: "all", libraryId: "lib" });
    accessOf.set("kid", { mode: "some", libraryId: "lib", visible: new Set(["t1"]) });
    accessOf.set("none", { mode: "none" });
    apply.mockResolvedValue({ ...empty, added: [track("t1"), track("t2")] });
    await onJellyfinLibraryChanged({ ItemsAdded: ["t1", "t2"] }, 1000);
    const byUser = Object.fromEntries(sent.map((s) => [s.userId, (s.msg as { added: { jellyfinId: string }[] }).added.map((a) => a.jellyfinId)]));
    expect(byUser).toEqual({ all: ["t1", "t2"], kid: ["t1"] });
  });

  it("la même copie, d'un autre appareil, dans les 2 s : traitée une fois", async () => {
    accessOf.set("all", { mode: "all", libraryId: "lib" });
    apply.mockResolvedValue({ ...empty, added: [track("t1")] });
    await onJellyfinLibraryChanged({ ItemsAdded: ["t1"] }, 1000);
    await onJellyfinLibraryChanged({ ItemsAdded: ["t1"] }, 1500);
    await onJellyfinLibraryChanged({ ItemsAdded: ["t1"] }, 4000);
    expect(apply).toHaveBeenCalledTimes(2);
  });

  it("une playlist privée touchée : seul le compte qui la voit l'apprend", async () => {
    accessOf.set("owner", { mode: "all", libraryId: "lib" });
    accessOf.set("other", { mode: "all", libraryId: "lib" });
    playlistsOf.set("owner", ["p1"]);
    apply.mockResolvedValue({ ...empty, unresolved: ["p1"] });
    await onJellyfinLibraryChanged({ ItemsUpdated: ["p1"] }, 1000);
    expect(sent).toEqual([{ userId: "owner", msg: { type: "music:playlist", playlistId: "p1" } }]);
  });
});

describe("évènements de données d'utilisateur", () => {
  it("seul le cœur d'un élément de la musique, à son compte", async () => {
    accessOf.set("u1", { mode: "all", libraryId: "lib" });
    known.add("t1");
    await onJellyfinUserDataChanged({ UserId: "U1", UserDataList: [{ ItemId: "T1", IsFavorite: true }, { ItemId: "movie", IsFavorite: true }] }, 1000);
    expect(sent).toEqual([{ userId: "u1", msg: { type: "music:userdata", changes: [{ jellyfinId: "t1", favorite: true }] } }]);
  });
});

describe("tri d'une liste gardé", () => {
  it("le compte qui l'a gardé l'apprend sur tous ses appareils, par la clé de la liste seule", () => {
    sent.length = 0;
    tellListPrefsChanged("u1", "playlist:p1");
    expect(sent).toEqual([{ userId: "u1", msg: { type: "music:listPrefs", key: "playlist:p1" } }]);
  });
});
