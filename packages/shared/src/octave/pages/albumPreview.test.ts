import { describe, expect, it } from "vitest";
import type { MusicAlbum } from "@tentacle-tv/shared/music";
import { albumPreview, albumPreviewOfTrack, rememberAlbumPreview } from "./albumPreview";

const album = (n: number): MusicAlbum => ({
  key: `ext:sillon:rg:${n}`, jellyfinId: null, external: { pluginId: "sillon", id: `rg:${n}` }, title: `Album ${n}`,
  artists: [{ name: "Artiste", mbid: null, jellyfinId: null }], year: 2017, releaseDate: null, kind: "album", artworkUrl: "https://caa/x.jpg",
  trackCount: 12, durationMs: null, mbids: { release: null, releaseGroup: null }, label: "Label", tracks: [],
});

describe("aperçu d'album (carte → vue)", () => {
  it("rend ce que la carte montrait, sans titres ni label (rien d'inventé ni de périmé)", () => {
    rememberAlbumPreview("ext:sillon:rg:1", album(1));
    expect(albumPreview("ext:sillon:rg:1")).toMatchObject({ title: "Album 1", artworkUrl: "https://caa/x.jpg", year: 2017, tracks: undefined, label: undefined });
    expect(albumPreview("ext:sillon:rg:inconnu")).toBeUndefined();
  });

  it("est borné : les plus anciens partent", () => {
    for (let i = 0; i < 205; i++) rememberAlbumPreview(`k${i}`, album(i));
    expect(albumPreview("k0")).toBeUndefined();
    expect(albumPreview("k204")?.title).toBe("Album 204");
  });
});

describe("aperçu d'album (lien d'une rangée → vue)", () => {
  const artists = [{ name: "Stromae", mbid: null, jellyfinId: null, external: { pluginId: "sillon", id: "imp:ar:U3Ryb21hZQ" } }];
  const art = "/api/plugins/sillon/music/art/q/0123456789abcdef/250?ar=Stromae&ti=Papaoutai";

  it("un album d'ailleurs : son nom, les artistes, la pochette de la rangée", () => {
    const album = { title: "Racine carrée", mbid: null, jellyfinId: null, external: { pluginId: "sillon", id: "imp:al:x" } };
    expect(albumPreviewOfTrack("ext:sillon:imp:al:x", { album, artists, artworkUrl: art, year: 2013 })).toMatchObject({
      key: "ext:sillon:imp:al:x", title: "Racine carrée", artworkUrl: art, year: 2013, external: { pluginId: "sillon", id: "imp:al:x" }, trackCount: null,
    });
  });

  it("rien pour un album de la bibliothèque ou sans page", () => {
    expect(albumPreviewOfTrack("jf", { album: { title: "A", mbid: null, jellyfinId: "jf1" }, artists })).toBeNull();
    expect(albumPreviewOfTrack("k", { album: { title: "A", mbid: null, jellyfinId: null, external: null }, artists })).toBeNull();
    expect(albumPreviewOfTrack("k", { album: null, artists })).toBeNull();
  });
});
