/**
 * Octave — le cache de la musique : retouches optimistes (cœur partout,
 * titres likés, entrées de playlist) et ce que chaque évènement `music:*` relit.
 */

import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import type { MusicPlaylistDetail, MusicSearchResponse, MusicTrack } from "@tentacle-tv/shared/music";
import { insertedEntries, likedAfter, movedEntries, removedEntry, withFavorites } from "./musicCachePatch";
import { musicKeys } from "./musicQueryKeys";
import { applyMusicEvent } from "./useMusicLive";

const track = (id: string, favorite = false): MusicTrack => ({
  key: `jf:${id}`, jellyfinId: id, external: null, title: id, artists: [], album: null, durationMs: null, trackNumber: null,
  discNumber: null, year: null, artworkUrl: null, mbids: { recording: null, release: null, releaseGroup: null, artists: [] },
  availability: "library", format: null, favorite,
});

const search = (...tracks: MusicTrack[]): MusicSearchResponse => ({ query: "q", tracks, albums: [], artists: [], playlists: [], tookMs: 1 });
const entries = (...ids: string[]) => ids.map((id, position) => ({ entryId: `e${id}`, position, track: track(id) }));

describe("cœur posé partout", () => {
  it("dans une réponse imbriquée, sans toucher au reste (même référence si rien ne change)", () => {
    const data = { pages: [{ items: [track("a"), track("b")] }], pageParams: [""] };
    const patched = withFavorites(data, new Map([["b", true]]));
    expect(patched.pages[0]!.items.map((t) => t.favorite)).toEqual([false, true]);
    expect(patched.pages[0]!.items[0]).toBe(data.pages[0]!.items[0]);
    expect(withFavorites(data, new Map([["z", true]]))).toBe(data);
  });

  it("titres likés : un cœur retiré sort, un cœur posé entre en tête", () => {
    const liked = { pages: [{ items: [track("a", true)], total: 1, cursor: null }], pageParams: [""] };
    expect(likedAfter(liked, track("a"), false)?.pages[0]).toEqual({ items: [], total: 0, cursor: null });
    expect(likedAfter(liked, track("b"), true)?.pages[0]!.items.map((t) => [t.jellyfinId, t.favorite])).toEqual([["b", true], ["a", true]]);
    expect(likedAfter(liked, track("a"), true)).toBe(liked);
  });
});

describe("entrées de playlist (optimiste)", () => {
  it("insérer à une position, sans doublon", () => {
    expect(insertedEntries(entries("a", "b", "c"), [track("x")], 1).map((e) => [e.track.jellyfinId, e.position])).toEqual([["a", 0], ["x", 1], ["b", 2], ["c", 3]]);
    expect(insertedEntries(entries("a", "b"), [track("x")]).map((e) => e.track.jellyfinId)).toEqual(["a", "b", "x"]);
    expect(insertedEntries(entries("a", "b", "c"), [track("c")], 0).map((e) => e.track.jellyfinId)).toEqual(["c", "a", "b"]);
    expect(insertedEntries(entries("a"), [track("x")], 0)[0]!.entryId).toBe("pending:jf:x");
  });

  it("déplacer, retirer : positions renumérotées", () => {
    expect(movedEntries(entries("a", "b", "c"), "ec", 0).map((e) => `${e.track.jellyfinId}${e.position}`)).toEqual(["c0", "a1", "b2"]);
    expect(removedEntry(entries("a", "b", "c"), "eb").map((e) => `${e.track.jellyfinId}${e.position}`)).toEqual(["a0", "c1"]);
  });
});

describe("évènements music:* → cache", () => {
  function client() {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    qc.setQueryData(musicKeys.search("q", 20), search(track("t1"), track("t2")));
    qc.setQueryData(musicKeys.liked(100), { pages: [{ items: [], total: 0, cursor: null }], pageParams: [""] });
    qc.setQueryData(musicKeys.source("t1"), { url: "/api/music/stream/t1" });
    qc.setQueryData(musicKeys.playlist("p1"), { jellyfinId: "p1", entries: [] } as unknown as MusicPlaylistDetail);
    qc.setQueryData(musicKeys.playlist("p2"), { jellyfinId: "p2", entries: [] } as unknown as MusicPlaylistDetail);
    qc.setQueryData(musicKeys.match("ext:x:1@"), { tracks: [], albums: [] });
    return qc;
  }
  const invalidated = (qc: QueryClient, key: readonly unknown[]) => qc.getQueryState(key)?.isInvalidated === true;

  it("music:userdata : le cœur posé dans le cache, titres likés relus", () => {
    const qc = client();
    applyMusicEvent(qc, { type: "music:userdata", changes: [{ jellyfinId: "t2", favorite: true }] });
    expect(qc.getQueryData<MusicSearchResponse>(musicKeys.search("q", 20))!.tracks.map((t) => t.favorite)).toEqual([false, true]);
    expect(invalidated(qc, musicKeys.liked(100))).toBe(true);
    expect(invalidated(qc, musicKeys.playlist("p1"))).toBe(false);
  });

  it("music:library : listes relues, la source d'un titre retiré oubliée", () => {
    const qc = client();
    applyMusicEvent(qc, { type: "music:library", added: [], updated: [], removed: ["t1"] });
    expect(qc.getQueryData(musicKeys.source("t1"))).toBeUndefined();
    expect(invalidated(qc, musicKeys.search("q", 20))).toBe(true);
    // Un titre importé (Lidarr…) : ce que la bibliothèque a parmi les titres montrés d'ailleurs se relit.
    expect(invalidated(qc, musicKeys.match("ext:x:1@"))).toBe(true);
  });

  it("music:resolved : la correspondance avec la bibliothèque se relit", () => {
    const qc = client();
    applyMusicEvent(qc, { type: "music:resolved", pluginId: "x", externalId: "1", jellyfinId: "t9", recording: null, track: null });
    expect(invalidated(qc, musicKeys.match("ext:x:1@"))).toBe(true);
  });

  it("music:playlist : cette playlist-là seulement", () => {
    const qc = client();
    applyMusicEvent(qc, { type: "music:playlist", playlistId: "p1" });
    expect(invalidated(qc, musicKeys.playlist("p1"))).toBe(true);
    expect(invalidated(qc, musicKeys.playlist("p2"))).toBe(false);
    expect(invalidated(qc, musicKeys.search("q", 20))).toBe(false);
  });
});
