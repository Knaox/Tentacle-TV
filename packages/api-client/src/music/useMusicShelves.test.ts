import { describe, expect, it } from "vitest";
import type { MusicAlbum, MusicLibraryShelves, MusicPlaylist } from "@tentacle-tv/shared/music";
import { withFavorites } from "./musicCachePatch";
import { shelfFavoriteOf, shelvesAfter } from "./useMusicShelves";

const album = (id: string, favorite?: boolean): MusicAlbum => ({
  key: `jf:${id}`, jellyfinId: id, external: null, title: id, artists: [], year: null, releaseDate: null, kind: "album", artworkUrl: null,
  trackCount: null, durationMs: null, mbids: { release: null, releaseGroup: null }, ...(favorite !== undefined && { favorite }),
});
const extAlbum: MusicAlbum = { ...album("x"), key: "ext:p:1", jellyfinId: null, external: { pluginId: "p", id: "1" } };
const playlist = (id: string, favorite?: boolean): MusicPlaylist => ({ jellyfinId: id, name: id, trackCount: 0, durationMs: null, artworkUrl: null, editable: true, ...(favorite !== undefined && { favorite }) });
const EMPTY: MusicLibraryShelves = { albums: [], artists: [], playlists: [], order: { albums: [], artists: [], playlists: [] } };

describe("favoris en cache", () => {
  it("un favori posé arrive en tête des favoris ; retiré, il en part", () => {
    const one = shelvesAfter(EMPTY, { section: "albums", item: album("a") }, true);
    expect(one.albums.map((a) => [a.key, a.favorite])).toEqual([["jf:a", true]]);
    expect(shelvesAfter(one, { section: "albums", item: album("a", true) }, false).albums).toEqual([]);
    const pl = shelvesAfter(EMPTY, { section: "playlists", item: { kind: "library", playlist: playlist("p") } }, true);
    expect(pl.playlists[0]).toMatchObject({ kind: "library", playlist: { favorite: true } });
  });
  it("l'état : le drapeau d'abord, sinon la présence parmi les favoris (extension) ; rien sans la capacité", () => {
    expect(shelfFavoriteOf({ section: "albums", item: album("a", true) }, EMPTY, true)).toBe(true);
    expect(shelfFavoriteOf({ section: "albums", item: extAlbum }, EMPTY, true)).toBe(false);
    expect(shelfFavoriteOf({ section: "albums", item: extAlbum }, { ...EMPTY, albums: [extAlbum] }, true)).toBe(true);
    expect(shelfFavoriteOf({ section: "albums", item: album("a", true) }, EMPTY, false)).toBeUndefined();
  });
  it("le patch du cœur touche aussi un album, un artiste, une playlist qui portent leur favori, et descend dans leurs titres", () => {
    const track = { key: "jf:t", jellyfinId: "t", favorite: false, availability: "library" };
    const data = { albums: [{ ...album("a", false), tracks: [track] }], playlists: [playlist("a", false)], artists: [{ name: "x", jellyfinId: "a", mbid: null }] };
    const out = withFavorites(data, new Map([["a", true], ["t", true]]));
    expect(out.albums[0]!.favorite).toBe(true);
    expect(out.albums[0]!.tracks[0]!.favorite).toBe(true);
    expect(out.playlists[0]!.favorite).toBe(true);
    expect(out.artists[0]).toBe(data.artists[0]);
  });
  it("un album d'un serveur d'avant (sans drapeau) n'est jamais marqué", () => {
    const data = [album("a")];
    expect(withFavorites(data, new Map([["a", true]]))).toBe(data);
  });
});
