import { describe, expect, it } from "vitest";
import type { LibraryAlbumMatch, LibraryMatches } from "@tentacle-tv/api-client";
import type { MusicAlbum, MusicTrack } from "@tentacle-tv/shared/music";
import { matchInputOf, ownedLists } from "../search/ownedSearch";
import { ownedAlbums, ownedCount, ownedTracks, searchAlbumOwnership } from "./ownedItems";
import { queueOutsiders } from "./useQueueLibraryTwins";

const track = (key: string, over: Partial<MusicTrack> = {}): MusicTrack => ({
  key, jellyfinId: key.startsWith("jf:") ? key.slice(3) : null, external: key.startsWith("ext:") ? { pluginId: "src", id: key.slice(8) } : null,
  title: key, artists: [], album: null, durationMs: 1000, trackNumber: null, discNumber: null, year: null, artworkUrl: null,
  mbids: { recording: null, release: null, releaseGroup: null, artists: [] }, availability: key.startsWith("jf:") ? "library" : "remote", format: null, favorite: false, ...over,
});
const album = (key: string): MusicAlbum => ({
  key, jellyfinId: key.startsWith("jf:") ? key.slice(3) : null, external: key.startsWith("ext:") ? { pluginId: "src", id: key.slice(8) } : null,
  title: key, artists: [], year: null, releaseDate: null, kind: "album", artworkUrl: null, trackCount: 3, durationMs: null, mbids: { release: null, releaseGroup: null },
});
const albumMatch = (lib: string, coverage: "full" | "partial"): LibraryAlbumMatch => ({ album: album(lib), coverage, tracks: new Map() });

describe("ce que la bibliothèque a, à l'affichage", () => {
  it("un titre reconnu devient celui de la bibliothèque, les autres restent (même liste si rien ne change)", () => {
    const list = [track("ext:src:1"), track("ext:src:2")];
    const owned = ownedTracks(list, new Map([["ext:src:2", track("jf:b")]]));
    expect(owned.map((t) => t.key)).toEqual(["ext:src:1", "jf:b"]);
    expect(ownedCount(owned)).toBe(1);
    expect(ownedTracks(list, new Map())).toBe(list);
  });

  it("un album entier devient celui de la bibliothèque, un album en partie est marqué, un absent ne l'est pas", () => {
    const shown = ownedAlbums([album("ext:src:a1"), album("ext:src:a2"), album("ext:src:a3")], new Map([["ext:src:a1", albumMatch("jf:A", "full")], ["ext:src:a2", albumMatch("jf:B", "partial")]]));
    expect(shown.map((s) => [s.album.key, s.ownership])).toEqual([["jf:A", "full"], ["ext:src:a2", "partial"], ["ext:src:a3", null]]);
  });

  it("deux parutions d'ailleurs du même album de la bibliothèque : une seule carte", () => {
    const m = albumMatch("jf:A", "full");
    expect(ownedAlbums([album("ext:src:a1"), album("ext:src:a2")], new Map([["ext:src:a1", m], ["ext:src:a2", m]]))).toHaveLength(1);
  });

  it("dans la recherche, un album de la bibliothèque d'emblée porte aussi sa pastille", () => {
    expect(searchAlbumOwnership(album("jf:X"), new Map())).toBe("full");
    expect(searchAlbumOwnership(album("ext:src:y"), new Map())).toBeNull();
  });
});

describe("la recherche", () => {
  const matches: LibraryMatches = { tracks: new Map([["ext:src:t", track("jf:t")]]), albums: new Map([["ext:src:al", albumMatch("jf:AL", "full")]]), settled: true };
  it("le meilleur résultat, les titres et les albums reconnus", () => {
    const lists = { top: { kind: "album" as const, album: album("ext:src:al"), tracks: [track("ext:src:t")] }, tracks: [track("ext:src:t"), track("ext:src:u")], albums: [album("ext:src:al")], artists: [], playlists: [] };
    const out = ownedLists(lists, matches);
    expect(out.lists?.top).toMatchObject({ kind: "album", album: { key: "jf:AL" }, tracks: [{ key: "jf:t" }] });
    expect(out.lists?.tracks.map((t) => t.key)).toEqual(["jf:t", "ext:src:u"]);
    expect(out.albumOwnership.get("jf:AL")).toBe("full");
    expect(matchInputOf(lists).tracks.map((t) => t.key)).toEqual(["ext:src:t", "ext:src:t", "ext:src:u"]);
  });
});

describe("la file", () => {
  it("les titres d'ailleurs, une fois, dans une fenêtre recalée tous les 50 titres", () => {
    const queue = [...Array.from({ length: 60 }, (_, i) => track(`ext:src:${i}`)), track("jf:x"), track("ext:src:1")];
    expect(queueOutsiders(queue, 10)).toHaveLength(60);
    expect(queueOutsiders(queue, 49)[0]?.key).toBe("ext:src:0");
    expect(queueOutsiders(queue, 55).map((t) => t.key)).toEqual(["ext:src:50", "ext:src:51", "ext:src:52", "ext:src:53", "ext:src:54", "ext:src:55", "ext:src:56", "ext:src:57", "ext:src:58", "ext:src:59", "ext:src:1"]);
  });
});
