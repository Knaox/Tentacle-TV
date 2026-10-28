/** Titres et copies gardées des tests d'Octave hors ligne (jamais exportés du paquet). */

import type { MusicTrack } from "@tentacle-tv/shared/music";
import type { KeptMusicTrack } from "../../core/musicLibrary";

export function musicTrack(key: string, partial: Partial<MusicTrack> = {}): MusicTrack {
  const library = key.startsWith("jf:");
  return {
    key, jellyfinId: library ? key.slice(3) : null, external: null, title: key, artists: [{ name: "A", mbid: null, jellyfinId: null }], album: null,
    durationMs: 1000, trackNumber: 1, discNumber: 1, year: null, artworkUrl: null, mbids: { recording: null, release: null, releaseGroup: null, artists: [] },
    availability: library ? "library" : "remote", format: null, favorite: false, ...partial,
  };
}

export function keptTrack(key: string, partial: Partial<KeptMusicTrack> = {}): KeptMusicTrack {
  return {
    fileId: 1, itemId: key, trackKey: key, origin: key.startsWith("jf:") ? "library" : "external", variant: "original", preset: null,
    status: "complete", errorCode: null, pausedByUser: false, bytesDone: 100, expectedSize: 100, title: key, artist: null, album: null,
    albumKey: null, discNumber: null, trackNumber: null, durationMs: null, coverRel: null, sourcePath: null, trackJson: "{}", createdAt: 0,
    ...partial,
  };
}
