import { describe, expect, it } from "vitest";
import type { MusicAlbum, MusicTrack } from "@tentacle-tv/shared/music";
import { libraryMatchRequest } from "./useMusicLibraryMatch";

const ext = (id: string, over: Partial<MusicTrack> = {}): MusicTrack => ({
  key: `ext:src:${id}`, jellyfinId: null, external: { pluginId: "src", id }, title: `T ${id}`, artists: [{ name: "A", mbid: null, jellyfinId: null }],
  album: { title: "Al", mbid: null, jellyfinId: null }, durationMs: 1000, trackNumber: 1, discNumber: 1, year: null, artworkUrl: null,
  mbids: { recording: null, release: null, releaseGroup: null, artists: [] }, availability: "remote", format: null, favorite: false, ...over,
});
const lib = (id: string) => ext(id, { key: `jf:${id}`, jellyfinId: id, external: null, availability: "library" });
const album = (id: string, over: Partial<MusicAlbum> = {}): MusicAlbum => ({
  key: `ext:src:${id}`, jellyfinId: null, external: { pluginId: "src", id }, title: "Al", artists: [], year: null, releaseDate: null,
  kind: "soundtrack", artworkUrl: null, trackCount: 2, durationMs: null, mbids: { release: null, releaseGroup: null }, ...over,
});

describe("la demande « dans la bibliothèque ? »", () => {
  it("seulement ce qui est hors bibliothèque, une fois", () => {
    const req = libraryMatchRequest([ext("1"), lib("2"), ext("1")], [{ album: album("al1"), tracks: [ext("3"), lib("4")] }]);
    expect(req?.tracks?.map((t) => t.ref)).toEqual(["ext:src:1"]);
    expect(req?.albums?.[0]).toMatchObject({ ref: "ext:src:al1", compilation: true, trackCount: 2 });
    expect(req?.albums?.[0]?.tracks?.map((t) => t.ref)).toEqual(["ext:src:3"]);
  });

  it("rien à demander : aucune requête", () => {
    expect(libraryMatchRequest([lib("1")], [{ album: { ...album("x"), jellyfinId: "x", external: null } }])).toBeNull();
    expect(libraryMatchRequest([], [])).toBeNull();
  });

  it("bornée (200 titres)", () => {
    expect(libraryMatchRequest(Array.from({ length: 250 }, (_, i) => ext(String(i))), [])?.tracks).toHaveLength(200);
  });
});
