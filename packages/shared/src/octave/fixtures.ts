/**
 * Octave — des titres de test, conformes au contrat (`MusicTrack`). Servent aux
 * tests purs et aux scènes de banc ; jamais importés par le code livré.
 */

import { externalTrackKey, libraryTrackKey, type MusicAlbum, type MusicTrack } from "../music";

export function libraryTrack(id: string, overrides: Partial<MusicTrack> = {}): MusicTrack {
  return {
    key: libraryTrackKey(id),
    jellyfinId: id,
    external: null,
    title: `Titre ${id}`,
    artists: [{ name: "Artiste", mbid: null, jellyfinId: "artist-1" }],
    album: { title: "Album", mbid: null, jellyfinId: "album-1" },
    durationMs: 200_000,
    trackNumber: 1,
    discNumber: 1,
    year: 2020,
    artworkUrl: null,
    mbids: { recording: null, release: null, releaseGroup: null, artists: [] },
    availability: "library",
    format: { codec: "flac", container: "flac", sampleRate: 96_000, bitDepth: 24, bitrate: 2_800_000, channels: 2, lossless: true },
    favorite: false,
    ...overrides,
  };
}

export function externalTrack(pluginId: string, id: string, overrides: Partial<MusicTrack> = {}): MusicTrack {
  const external = { pluginId, id };
  return {
    ...libraryTrack("x", overrides),
    key: externalTrackKey(external),
    jellyfinId: null,
    external,
    title: `Externe ${id}`,
    availability: "remote",
    format: null,
    ...overrides,
  };
}

export function libraryAlbum(id: string, overrides: Partial<MusicAlbum> = {}): MusicAlbum {
  return {
    key: `jf:${id}`,
    jellyfinId: id,
    external: null,
    title: `Album ${id}`,
    artists: [{ name: "Artiste", mbid: null, jellyfinId: "artist-1" }],
    year: 2020,
    releaseDate: null,
    kind: "album",
    artworkUrl: null,
    trackCount: 10,
    durationMs: 2_400_000,
    mbids: { release: null, releaseGroup: null },
    ...overrides,
  };
}

/** Un tirage fixe : `values` en boucle. */
export function fixedRandom(values: readonly number[]): () => number {
  let i = 0;
  return () => {
    const v = values[i % values.length] ?? 0;
    i += 1;
    return v;
  };
}
