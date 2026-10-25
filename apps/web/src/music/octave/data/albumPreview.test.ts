import { describe, expect, it } from "vitest";
import type { MusicAlbum } from "@tentacle-tv/shared/music";
import { albumPreview, rememberAlbumPreview } from "./albumPreview";

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
