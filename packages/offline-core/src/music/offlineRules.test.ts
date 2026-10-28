/** Hors ligne : la copie gardée seulement, la file qui part du titre gardé, la recherche dans la musique gardée. */

import { describe, expect, it } from "vitest";
import { searchKept } from "./keptSearch";
import { playableNow, playableQueue } from "./offlinePlayback";
import { keptTrack, musicTrack } from "./testing/fixtures";

const byKey = new Map([
  ["jf:b", keptTrack("jf:b")],
  ["jf:d", keptTrack("jf:d")],
  ["jf:c", keptTrack("jf:c", { status: "downloading" })],
]);
const list = ["jf:a", "jf:b", "jf:c", "jf:d"].map((k) => musicTrack(k));

describe("lecture hors ligne", () => {
  it("en ligne tout se lit ; hors ligne la copie complète seulement", () => {
    expect(playableNow("jf:a", false, byKey)).toBe(true);
    expect(playableNow("jf:a", true, byKey)).toBe(false);
    expect(playableNow("jf:c", true, byKey)).toBe(false);
    expect(playableNow("jf:b", true, byKey)).toBe(true);
  });

  it("la file hors ligne garde l'ordre, part du titre touché ou du suivant gardé", () => {
    expect(playableQueue(list, 3, true, byKey)).toEqual({ tracks: [list[1], list[3]], index: 1 });
    expect(playableQueue(list, 2, true, byKey)?.index).toBe(1);
    expect(playableQueue(list, 0, true, byKey)?.index).toBe(0);
    expect(playableQueue(list, 2, false, byKey)).toEqual({ tracks: list, index: 2 });
    expect(playableQueue([list[0]!], 0, true, byKey)).toBeNull();
  });
});

describe("searchKept", () => {
  it("titre, artiste, album, accents ignorés ; le titre devant l'artiste", () => {
    const tracks = [
      musicTrack("jf:1", { title: "Héros", artists: [{ name: "Zed", mbid: null, jellyfinId: null }] }),
      musicTrack("jf:2", { title: "Autre", artists: [{ name: "Les Heros", mbid: null, jellyfinId: null }] }),
      musicTrack("jf:3", { title: "Rien" }),
    ];
    const found = searchKept(tracks, [], "heros");
    expect(found.tracks.map((t) => t.key)).toEqual(["jf:1", "jf:2"]);
    expect(searchKept(tracks, [], "  ").tracks).toEqual([]);
  });

  it("les albums et playlists gardés par leur nom", () => {
    const collection = { key: "playlist:jf:p", kind: "playlist" as const, title: "Nuit d'été", subtitle: null, artworkUrl: null, tracks: [] };
    expect(searchKept([], [collection], "nuit ete").collections).toEqual([collection]);
  });
});
