import { describe, expect, it } from "vitest";
import type { IndexRow } from "../index/indexTypes";
import { composeArtistMix, distinctInOrder, mixArtistOrder, rankArtists, seededShuffle } from "./homeForYouRules";

function track(id: string, artistId: string, albumId: string): IndexRow {
  return {
    id, kind: "track", name: id, sortName: id, albumId, albumName: albumId, albumArtist: null,
    artists: [{ id: artistId, name: artistId.toUpperCase(), mbid: null }], year: null, trackNumber: null, discNumber: null,
    durationMs: null, recordingMbid: null, releaseMbid: null, releaseGroupMbid: null, artistMbid: null, format: null,
    sizeBytes: null, normalizationGain: null, imageTag: null, childCount: null, dateCreated: null,
  };
}

const many = (artist: string, n: number, albums = 3) => Array.from({ length: n }, (_, i) => track(`${artist}${i}`, artist, `${artist}-al${i % albums}`));

describe("rankArtists", () => {
  it("les écoutes récentes, les plus écoutés et les cœurs comptent, un cœur sans écoute non", () => {
    const ranked = rankArtists({
      recent: [track("t1", "a", "x"), track("t2", "b", "y"), track("t3", "b", "y")],
      most: [track("t4", "c", "z")],
      favoriteTracks: [],
      favoriteArtists: new Set(["a", "dormant"]),
    });
    expect(ranked[0]).toBe("a");
    expect(ranked).toContain("b");
    expect(ranked).toContain("c");
    expect(ranked).not.toContain("dormant");
  });
});

describe("seededShuffle", () => {
  it("même graine, même ordre ; autre graine, autre ordre ; rien de perdu", () => {
    const items = Array.from({ length: 20 }, (_, i) => i);
    expect(seededShuffle(items, "j1")).toEqual(seededShuffle(items, "j1"));
    expect(seededShuffle(items, "j1")).not.toEqual(seededShuffle(items, "j2"));
    expect([...seededShuffle(items, "j1")].sort((a, b) => a - b)).toEqual(items);
  });
});

describe("composeArtistMix", () => {
  it("deux titres de l'artiste pour un voisin, chacun une fois, 25 au plus", () => {
    const mix = composeArtistMix(many("a", 40), many("b", 20), new Set(), "s");
    expect(mix).toHaveLength(25);
    expect(new Set(mix.map((r) => r.id)).size).toBe(25);
    const fromB = mix.filter((r) => r.artists[0]?.id === "b").length;
    expect(fromB).toBe(8);
  });

  it("les titres aimés de l'artiste d'abord", () => {
    const mix = composeArtistMix(many("a", 10), [], new Set(["a7"]), "s");
    expect(mix[0]?.id).toBe("a7");
  });

  it("jamais deux fois de suite le même album quand on peut l'éviter", () => {
    // Assez de choix tout du long : 30 titres sur 5 albums, 10 voisins sur 3 albums.
    const mix = composeArtistMix(many("a", 30, 5), many("b", 10, 3), new Set(), "s");
    for (let i = 1; i < mix.length; i++) expect(mix[i]?.albumId).not.toBe(mix[i - 1]?.albumId);
  });

  it("finit avec les titres de son artiste : pas de voisins seuls à la fin", () => {
    const mix = composeArtistMix(many("a", 4), many("b", 30), new Set(), "s");
    expect(mix.filter((r) => r.artists[0]?.id === "a")).toHaveLength(4);
    expect(mix.length).toBeLessThanOrEqual(6);
  });
});

describe("outils", () => {
  it("distinctInOrder et mixArtistOrder", () => {
    expect(distinctInOrder([track("1", "a", "x"), track("2", "b", "x"), track("3", "a", "y")], (r) => r.albumId)).toEqual(["x", "y"]);
    expect(mixArtistOrder([track("1", "a", "x"), track("2", "b", "x"), track("3", "b", "y")])).toEqual(["B", "A"]);
  });
});
