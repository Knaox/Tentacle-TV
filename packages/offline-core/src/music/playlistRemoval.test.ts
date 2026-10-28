/** Un titre retiré d'une playlist gardée quitte l'appareil, sauf s'il est gardé ailleurs. */

import { describe, expect, it } from "vitest";
import type { KeptMusicCollection, KeptMusicTrack } from "../core/musicLibrary";
import { libraryPlaylistKey, planPlaylistRemoval } from "./playlistRemoval";

let nextId = 1;
function kept(key: string, partial: Partial<KeptMusicTrack> = {}): KeptMusicTrack {
  return {
    fileId: nextId++, itemId: key, trackKey: key, origin: "library", variant: "original", preset: null, status: "complete", errorCode: null,
    pausedByUser: false, bytesDone: 1, expectedSize: 1, title: key, artist: null, album: null, albumKey: null, discNumber: null,
    trackNumber: null, durationMs: null, coverRel: null, sourcePath: null, trackJson: "{}", createdAt: 0, ...partial,
  };
}
const coll = (key: string, kind: KeptMusicCollection["kind"], trackKeys: string[]): KeptMusicCollection => ({
  key, kind, title: key, subtitle: null, coverItemId: null, trackKeys, updatedAt: 0,
});

const A = libraryPlaylistKey("a");
const B = libraryPlaylistKey("b");

describe("retirer un titre d'une playlist gardée", () => {
  it("seul dans cette playlist : la collection le perd et ses fichiers partent", () => {
    const k1 = kept("jf:1");
    const k2 = kept("jf:2");
    const plan = planPlaylistRemoval({ kept: [k1, k2], collections: [coll(A, "playlist", ["jf:1", "jf:2"])], playlistKey: A, removedKeys: ["jf:1"] });
    expect(plan.saveCollections).toEqual([coll(A, "playlist", ["jf:2"])]);
    expect(plan.removeFileIds).toEqual([k1.fileId]);
  });

  it("aussi dans une AUTRE playlist gardée : il reste sur l'appareil", () => {
    const k1 = kept("jf:1");
    const plan = planPlaylistRemoval({
      kept: [k1],
      collections: [coll(A, "playlist", ["jf:1"]), coll(B, "playlist", ["jf:1"])],
      playlistKey: A,
      removedKeys: ["jf:1"],
    });
    expect(plan.saveCollections[0]?.trackKeys).toEqual([]);
    expect(plan.removeFileIds).toEqual([]);
  });

  it("retenu par un album gardé, « Titres likés » gardés ou gardé seul : il reste", () => {
    for (const other of [coll("album:x", "album", ["jf:1"]), coll("playlist:liked", "playlist", ["jf:1"]), coll("track:jf:1", "track", ["jf:1"])]) {
      const plan = planPlaylistRemoval({ kept: [kept("jf:1")], collections: [coll(A, "playlist", ["jf:1"]), other], playlistKey: A, removedKeys: ["jf:1"] });
      expect(plan.removeFileIds).toEqual([]);
    }
  });

  it("une occurrence d'un doublon part, l'autre reste : rien ne bouge", () => {
    const plan = planPlaylistRemoval({ kept: [kept("jf:1")], collections: [coll(A, "playlist", ["jf:1"])], playlistKey: A, removedKeys: ["jf:1"], stillListed: new Set(["jf:1"]) });
    expect(plan).toEqual({ keep: [], removeFileIds: [], saveCollections: [], removeCollections: [] });
  });

  it("playlist non gardée, ou titre qu'elle ne garde pas : rien", () => {
    const k = [kept("jf:1")];
    expect(planPlaylistRemoval({ kept: k, collections: [], playlistKey: A, removedKeys: ["jf:1"] }).saveCollections).toEqual([]);
    expect(planPlaylistRemoval({ kept: k, collections: [coll(A, "playlist", ["jf:2"])], playlistKey: A, removedKeys: ["jf:1"] }).removeFileIds).toEqual([]);
  });

  it("toutes les copies du titre partent (original et Allégé), jamais une copie déjà annulée", () => {
    const a = kept("jf:1");
    const b = kept("jf:1", { variant: "light", preset: "a256" });
    const c = kept("jf:1", { status: "canceled" });
    const plan = planPlaylistRemoval({ kept: [a, b, c], collections: [coll(A, "playlist", ["jf:1"])], playlistKey: A, removedKeys: ["jf:1"] });
    expect(plan.removeFileIds.sort()).toEqual([a.fileId, b.fileId].sort());
  });
});
