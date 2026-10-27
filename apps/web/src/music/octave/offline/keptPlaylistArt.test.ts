import { describe, expect, it } from "vitest";
import type { KeptMusicTrack } from "@tentacle-tv/offline-core";
import { playlistMosaic, type MusicTrack } from "@tentacle-tv/shared/music";
import { deviceModel } from "./deviceModel";
import { keptCollectionCover, keptPlaylistId } from "./keptPlaylistArt";

const NOW = Date.UTC(2026, 9, 28, 12);
const local = (rel: string) => `tentacle://local/${rel}`;

/** Le titre n de l'album `album`, tel que le serveur l'a montré (pochette embarquée). */
function serverTrack(album: string, n: number, external = false): MusicTrack {
  const id = `${album}${n}`;
  return {
    key: external ? `ext:sillon:${id}` : `jf:${id}`, jellyfinId: external ? null : id, external: external ? { pluginId: "sillon", id } : null, title: id,
    artists: [{ name: `art-${album}`, mbid: null, jellyfinId: `ar${album}` }], album: { title: album, mbid: null, jellyfinId: external ? null : `al${album}` },
    durationMs: 1000, trackNumber: n, discNumber: 1, year: null, artworkUrl: `/api/music/artwork/${id}?tag=x`,
    mbids: { recording: null, release: null, releaseGroup: null, artists: [] }, availability: external ? "cache" : "library", format: null, favorite: false,
  };
}

function kept(track: MusicTrack, partial: Partial<KeptMusicTrack> = {}): KeptMusicTrack {
  return {
    fileId: 1, itemId: track.jellyfinId ?? track.key, trackKey: track.key, origin: track.jellyfinId ? "library" : "external", variant: "original", preset: null,
    status: "complete", errorCode: null, pausedByUser: false, bytesDone: 1, expectedSize: 1, title: track.title, artist: null, album: null, albumKey: null,
    discNumber: 1, trackNumber: 1, durationMs: 1000, coverRel: `music/${track.key}/cover.jpg`, sourcePath: null, trackJson: JSON.stringify(track), createdAt: 0, ...partial,
  };
}

function setup(tracks: MusicTrack[], keptOf: (t: MusicTrack) => KeptMusicTrack = (t) => kept(t), key = "playlist:jf:p1") {
  const keptTracks = tracks.map(keptOf);
  const model = deviceModel(keptTracks, [{ key, kind: key.startsWith("album") ? "album" : "playlist", title: "New", subtitle: null, coverItemId: null, trackKeys: tracks.map((t) => t.key), updatedAt: 1 }], local, { completeOnly: true });
  return { keptTracks, collection: model.collections[0]! };
}

const ten = Array.from({ length: 10 }, (_, k) => [serverTrack(`a${k}`, 1), serverTrack(`a${k}`, 2)]).flat();
/** L'album d'une pochette locale (`tentacle://local/music/jf:a31/cover.jpg` → `a3`). */
const albumOfLocal = (url: string) => /jf:(a\d+)\d\//.exec(url)?.[1];
const albumOfServer = (url: string) => /artwork\/(a\d+)\d\?/.exec(url)?.[1];

describe("keptCollectionCover", () => {
  it("la MÊME jaquette qu'en ligne (mêmes albums, même jour), avec les pochettes gardées", () => {
    const { keptTracks, collection } = setup(ten);
    const offline = keptCollectionCover(collection, keptTracks, { now: NOW, remote: false });
    const online = playlistMosaic(ten, "p1", NOW);
    expect(offline).toHaveLength(4);
    expect(offline.every((u) => u.startsWith("tentacle://local/"))).toBe(true);
    expect(offline.map(albumOfLocal)).toEqual(online.map(albumOfServer));
  });

  it("sans réseau, une pochette absente du disque ne fait jamais une case", () => {
    const { keptTracks, collection } = setup(ten, (t) => kept(t, { coverRel: t.title.startsWith("a3") || t.title.startsWith("a4") ? null : `music/${t.key}/cover.jpg` }));
    const urls = keptCollectionCover(collection, keptTracks, { now: NOW, remote: false });
    expect(urls).toHaveLength(4);
    expect(urls.every((u) => u.startsWith("tentacle://local/"))).toBe(true);
  });

  it("avec du réseau, une pochette pas encore gardée vient du serveur", () => {
    const { keptTracks, collection } = setup(ten, (t) => kept(t, { coverRel: null }));
    expect(keptCollectionCover(collection, keptTracks, { now: NOW, remote: true })).toEqual(playlistMosaic(ten, "p1", NOW));
  });

  it("les titres hors bibliothèque ne comptent pas s'il y en a de la bibliothèque (le cœur ne les voit pas)", () => {
    const withPending = [...ten, ...Array.from({ length: 6 }, (_, k) => serverTrack(`x${k}`, 1, true))];
    const { keptTracks, collection } = setup(withPending);
    const urls = keptCollectionCover(collection, keptTracks, { now: NOW, remote: false });
    expect(urls.every((u) => u.includes("/jf:"))).toBe(true);
  });

  it("moins de quatre albums : une pochette ; un album gardé garde la sienne", () => {
    const two = [serverTrack("a", 1), serverTrack("b", 1)];
    const playlist = setup(two);
    expect(keptCollectionCover(playlist.collection, playlist.keptTracks, { now: NOW, remote: false })).toHaveLength(1);
    const album = setup(ten, undefined, "album:jf:x");
    expect(keptCollectionCover(album.collection, album.keptTracks, { now: NOW, remote: false })).toEqual([album.collection.artworkUrl]);
  });

  it("rien à montrer : le repli de la collection (aucune image : la teinte du titre)", () => {
    const { keptTracks, collection } = setup(ten, (t) => kept(t, { coverRel: null }));
    expect(keptCollectionCover(collection, keptTracks, { now: NOW, remote: false })).toEqual(collection.artworkUrl ? [collection.artworkUrl] : []);
  });

  it("l'identifiant de la playlist se lit dans la clé gardée", () => {
    expect(keptPlaylistId({ key: "playlist:jf:016730ba", kind: "playlist" })).toBe("016730ba");
    expect(keptPlaylistId({ key: "album:jf:x", kind: "album" })).toBeNull();
  });
});
