import { describe, expect, it } from "vitest";
import type { ExternalMusicPlaylist, MusicAlbum, MusicArtist, MusicSearchResponse, MusicTrack } from "@tentacle-tv/shared/music";
import { sameTrack, twinText } from "../trackTwins";
import { isEmptyLayout, layoutSearch, SIDE_TRACKS, type ShownExternalLists } from "./searchLayout";

const track = (key: string, title: string, artist: string, durationMs: number | null = null, library = false): MusicTrack => ({
  key, jellyfinId: library ? key : null, external: library ? null : { pluginId: "sillon", id: key }, title, artists: [{ name: artist, mbid: null, jellyfinId: null }],
  album: null, durationMs, trackNumber: null, discNumber: null, year: null, artworkUrl: null,
  mbids: { recording: null, release: null, releaseGroup: null, artists: [] }, availability: library ? "library" : "remote", format: null, favorite: false,
});
const album = (key: string, title: string, artist: string, library = false): MusicAlbum => ({
  key, jellyfinId: library ? key : null, external: library ? null : { pluginId: "sillon", id: key }, title, artists: [{ name: artist, mbid: null, jellyfinId: null }],
  year: null, releaseDate: null, kind: "album", artworkUrl: null, trackCount: null, durationMs: null, mbids: { release: null, releaseGroup: null },
});
const artist = (key: string, name: string, library = false): MusicArtist => ({ key, jellyfinId: library ? key : null, external: null, name, mbid: null, imageUrl: null });
const playlist = (key: string): ExternalMusicPlaylist => ({ key, external: { pluginId: "sillon", id: key }, title: key, owner: null, trackCount: null, artworkUrl: null });
const lib = (over: Partial<MusicSearchResponse> = {}): MusicSearchResponse => ({ query: "q", tracks: [], albums: [], artists: [], playlists: [], tookMs: 1, ...over });
const ext = (over: Partial<ShownExternalLists> = {}): ShownExternalLists => ({ top: null, tracks: [], albums: [], artists: [], playlists: [], ...over });

describe("jumeaux de bibliothèque (sans MBID)", () => {
  it("même titre normalisé, même premier artiste, durée à ± 3 s si les deux la connaissent", () => {
    expect(twinText("Feel Good Inc.")).toBe(twinText("feel good inc"));
    expect(sameTrack(track("a", "Thunder", "Imagine Dragons", 187_000), track("b", "THUNDER", "imagine dragons", 189_000))).toBe(true);
    expect(sameTrack(track("a", "Thunder", "Imagine Dragons", 187_000), track("b", "Thunder", "Imagine Dragons", 240_000))).toBe(false);
    expect(sameTrack(track("a", "Thunder", "Imagine Dragons"), track("b", "Thunder", "RY X"))).toBe(false);
    expect(sameTrack(track("a", "Thunder", "Imagine Dragons", null), track("b", "Thunder", "Imagine Dragons", 240_000))).toBe(true);
  });
});

describe("mise en page d'une recherche (façon Apple Music)", () => {
  it("le meilleur résultat de l'extension, remplacé par son jumeau de bibliothèque, OUVRE la liste des titres (R5-06), une seule fois", () => {
    const mine = track("jf:1", "Thunder", "Imagine Dragons", 187_000, true);
    const theirs = track("ext:sillon:ytm:t:x", "Thunder", "Imagine Dragons", 187_000);
    const layout = layoutSearch(lib({ tracks: [mine] }), ext({ top: { kind: "track", track: theirs }, tracks: [theirs, track("ext:2", "Thunderstruck", "AC/DC")] }));
    expect(layout.top).toEqual({ kind: "track", track: mine });
    expect(layout.tracks.map((t) => t.key)).toEqual(["jf:1", "ext:2"]);
    expect(layout.sideTracks.map((t) => t.key)).toEqual(["jf:1", "ext:2"]);
  });

  it("R5-06 : un titre de l'extension en tête est le premier des titres, même quand la page ne l'y met pas", () => {
    const radiohead = track("ext:pa", "Paranoid Android", "Radiohead", 387_000);
    const layout = layoutSearch(null, ext({ top: { kind: "track", track: radiohead }, tracks: [track("ext:bm", "Paranoid Android", "Brad Mehldau"), track("ext:w", "Paranoid Android", "Weezer")] }));
    expect(layout.sideTracks.map((t) => t.key)).toEqual(["ext:pa", "ext:bm", "ext:w"]);
    expect(layout.tracks[0]?.key).toBe("ext:pa");
  });

  it("un artiste en tête : ses titres d'abord à côté de la carte, puis les autres ; la bibliothèque d'abord dans les titres", () => {
    const top = { kind: "artist" as const, artist: artist("ext:ar", "Kenshi Yonezu"), tracks: [track("ext:t1", "Lemon", "Kenshi Yonezu"), track("ext:t2", "IRIS OUT", "Kenshi Yonezu")] };
    const layout = layoutSearch(lib({ tracks: [track("jf:9", "KICK BACK", "Kenshi Yonezu", null, true)] }), ext({ top, tracks: [track("ext:t3", "Flamingo", "Kenshi Yonezu")], artists: [artist("ext:ar", "Kenshi Yonezu"), artist("ext:u", "Utada")] }));
    expect(layout.top?.kind).toBe("artist");
    expect(layout.sideTracks.map((t) => t.key)).toEqual(["ext:t1", "ext:t2", "jf:9", "ext:t3"]);
    expect(layout.tracks.map((t) => t.key)).toEqual(["jf:9", "ext:t3"]);
    // L'artiste de la carte n'est pas répété.
    expect(layout.artists.map((a) => a.key)).toEqual(["ext:u"]);
  });

  it("un album en tête : retiré des albums ; un album jumeau de la bibliothèque prend sa place", () => {
    const ytmAlbum = album("ext:al", "Evolve", "Imagine Dragons");
    const own = album("jf:al", "Evolve", "Imagine Dragons", true);
    const layout = layoutSearch(lib({ albums: [own] }), ext({ top: { kind: "album", album: ytmAlbum }, albums: [ytmAlbum, album("ext:al2", "Origins", "Imagine Dragons")] }));
    expect(layout.top).toEqual({ kind: "album", album: own });
    expect(layout.albums.map((a) => a.key)).toEqual(["ext:al2"]);
  });

  it("au plus six titres à côté de la carte ; playlists de l'extension sans doublon ; page vide reconnue", () => {
    const many = Array.from({ length: 10 }, (_, i) => track(`ext:${i}`, `T${i}`, "A"));
    const layout = layoutSearch(null, ext({ tracks: many, playlists: [playlist("ext:p"), playlist("ext:p")] }));
    expect(layout.sideTracks).toHaveLength(SIDE_TRACKS);
    expect(layout.tracks).toHaveLength(10);
    expect(layout.externalPlaylists).toHaveLength(1);
    expect(isEmptyLayout(layoutSearch(lib(), ext()))).toBe(true);
    expect(isEmptyLayout(layoutSearch(null, null))).toBe(true);
  });
});
