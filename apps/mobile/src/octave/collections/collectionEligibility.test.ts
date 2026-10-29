import { describe, expect, it } from "vitest";
import type { MusicAlbum, MusicArtist, MusicPlaylist } from "@tentacle-tv/shared/music";
import { hasCollectionActions } from "./collectionEligibility";

const album = (jellyfinId: string | null) => ({ key: "a", title: "A", artists: [], jellyfinId }) as unknown as MusicAlbum;
const artist = (jellyfinId: string | null) => ({ key: "r", name: "R", jellyfinId }) as unknown as MusicArtist;
const playlist = (over: Partial<MusicPlaylist>) => ({ jellyfinId: "p", name: "P", editable: false, ...over }) as MusicPlaylist;

describe("feuille d'actions d'un album, d'un artiste, d'une playlist", () => {
  it("un album ou un artiste de la bibliothèque : oui, si le serveur garde les favoris", () => {
    expect(hasCollectionActions({ section: "albums", item: album("j1") }, true)).toBe(true);
    expect(hasCollectionActions({ section: "artists", item: artist("j2") }, true)).toBe(true);
    expect(hasCollectionActions({ section: "albums", item: album("j1") }, false)).toBe(false);
  });

  it("hors bibliothèque (extension) : jamais pour un album ou un artiste", () => {
    expect(hasCollectionActions({ section: "albums", item: album(null) }, true)).toBe(false);
    expect(hasCollectionActions({ section: "artists", item: artist(null) }, true)).toBe(false);
  });

  it("une playlist : toujours avec la capacité (une d'extension comprise) ; sans, seulement à soi ou reçue", () => {
    const external = { section: "playlists" as const, item: { kind: "external" as const, playlist: { key: "x", external: { source: "s", id: "1" }, title: "X", owner: null, trackCount: null, artworkUrl: null } } };
    expect(hasCollectionActions(external as never, true)).toBe(true);
    expect(hasCollectionActions(external as never, false)).toBe(false);
    expect(hasCollectionActions({ section: "playlists", item: { kind: "library", playlist: playlist({ editable: true }) } }, false)).toBe(true);
    expect(hasCollectionActions({ section: "playlists", item: { kind: "library", playlist: playlist({}) } }, false)).toBe(false);
  });
});
