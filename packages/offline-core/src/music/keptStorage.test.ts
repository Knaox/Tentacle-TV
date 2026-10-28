import { describe, expect, it } from "vitest";
import type { KeptMusicTrack } from "../core/musicLibrary";
import { bytesOnDisk, collectionBytes, copiesOf } from "./keptStorage";

/**
 * Octave — « on ne sait pas combien de place prennent les titres » (Damien, 28/10) : la place d'un album, d'une
 * playlist, de tout, chaque copie comptée une fois.
 */
let nextFile = 1;
function kept(key: string, partial: Partial<KeptMusicTrack> = {}): KeptMusicTrack {
  return {
    fileId: nextFile++, itemId: key, trackKey: key, origin: "external", variant: "original", preset: null, status: "complete", errorCode: null,
    pausedByUser: false, bytesDone: 4_000_000, expectedSize: 4_000_000, title: key, artist: null, album: null, albumKey: null,
    discNumber: null, trackNumber: null, durationMs: null, coverRel: null, sourcePath: null, trackJson: "{}", createdAt: 0,
    ...partial,
  };
}

const map = (...items: KeptMusicTrack[]) => new Map(items.map((k) => [k.trackKey, k]));

describe("la place de la musique gardée", () => {
  it("une playlist : la somme de ses copies, les titres absents de l'appareil ne comptent pas", () => {
    const byKey = map(kept("a"), kept("b", { bytesDone: 6_000_000 }));
    expect(collectionBytes(["a", "b", "c"], byKey)).toBe(10_000_000);
  });

  it("une copie ne compte qu'une fois : le même titre deux fois, un titre renommé qui mène à la copie d'hier", () => {
    const old = kept("ext:hier");
    const byKey = map(old);
    byKey.set("ext:aujourdhui", old);
    expect(copiesOf(["ext:hier", "ext:aujourdhui", "ext:hier"], byKey)).toHaveLength(1);
    expect(collectionBytes(["ext:hier", "ext:aujourdhui"], byKey)).toBe(4_000_000);
  });

  it("une copie en préparation prend déjà sa place (octets écrits) ; une copie retirée, aucune", () => {
    const byKey = map(kept("a", { status: "downloading", bytesDone: 1_500_000, expectedSize: 4_000_000 }), kept("b", { status: "canceled" }));
    expect(collectionBytes(["a", "b"], byKey)).toBe(1_500_000);
    expect(copiesOf(["b"], byKey)).toEqual([]);
  });

  it("le total de l'appareil : toutes les copies, sauf les retirées", () => {
    expect(bytesOnDisk([kept("a"), kept("b", { bytesDone: 1_000 }), kept("c", { status: "canceled" })])).toBe(4_001_000);
    expect(bytesOnDisk([])).toBe(0);
  });
});
