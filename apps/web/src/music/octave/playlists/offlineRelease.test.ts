import { describe, expect, it } from "vitest";
import type { KeptMusicCollection, KeptMusicTrack } from "@tentacle-tv/offline-core";
import { keptPlaylistKey, offlineReleaseOf } from "./offlineRelease";

/**
 * Règle de Damien (27/10) : supprimer une playlist ne supprime JAMAIS un titre du serveur ; sur l'appareil, ne
 * part que la copie gardée UNIQUEMENT à cause de cette playlist — jamais une copie qu'une autre playlist, un
 * album ou un titre gardé seul retient.
 */
const P = "c".repeat(32);
const col = (key: string, kind: KeptMusicCollection["kind"], trackKeys: string[]): KeptMusicCollection => ({ key, kind, title: key, subtitle: null, coverItemId: null, trackKeys, updatedAt: 0 });
const file = (fileId: number, trackKey: string): KeptMusicTrack => ({ fileId, trackKey, itemId: trackKey.slice(3), origin: "library", variant: "original", preset: null, status: "complete" }) as KeptMusicTrack;

describe("une playlist supprimée, sur l'appareil", () => {
  const tracks = [file(1, "jf:a"), file(2, "jf:b"), file(3, "jf:c"), file(4, "jf:d"), file(5, "jf:b")];

  it("seuls partent les titres que cette seule playlist retenait (toutes leurs copies)", () => {
    const collections = [
      col(keptPlaylistKey(P), "playlist", ["jf:a", "jf:b", "jf:c", "jf:d"]),
      col("playlist:jf:autre", "playlist", ["jf:c"]),
      col("album:jf:al1", "album", ["jf:d"]),
    ];
    expect(offlineReleaseOf(P, collections, tracks)).toEqual({ collectionKey: keptPlaylistKey(P), fileIds: [1, 2, 5] });
  });

  it("un titre gardé SEUL (geste, likés gardés titre par titre) reste", () => {
    const collections = [col(keptPlaylistKey(P), "playlist", ["jf:a", "jf:b"]), col("track:jf:a", "track", ["jf:a"])];
    expect(offlineReleaseOf(P, collections, tracks)?.fileIds).toEqual([2, 5]);
  });

  it("tout est retenu ailleurs : la collection part, aucun fichier", () => {
    const collections = [col(keptPlaylistKey(P), "playlist", ["jf:c"]), col("playlist:jf:autre", "playlist", ["jf:c"])];
    expect(offlineReleaseOf(P, collections, tracks)).toEqual({ collectionKey: keptPlaylistKey(P), fileIds: [] });
  });

  it("une playlist qui n'était pas gardée hors ligne : rien ne bouge sur l'appareil", () => {
    expect(offlineReleaseOf(P, [col("album:jf:al1", "album", ["jf:a"])], tracks)).toBeNull();
    expect(offlineReleaseOf(P, [], [])).toBeNull();
  });
});
