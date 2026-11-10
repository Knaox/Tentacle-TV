/**
 * Le corpus du banc d'import (lot « pg ») : une bibliothèque et des playlists SYNTHÉTIQUES, déterministes, aux mots
 * réalistes (titres de 1 à 4 mots tirés d'un vocabulaire partagé : la FTS trouve des homonymes, comme en vrai).
 * Aucune donnée personnelle.
 */

import type { ImportedPlaylist, ImportedTrack } from "../../src/music/contract/musicImport";
import type { IndexRow } from "../../src/music/index/indexTypes";

const WORDS = (
  "love night heart fire dream light dance baby girl boy time world summer rain blue gold wild young forever home " +
  "away tonight stay alone free sky star moon sun river road city lost found run fly fall rise high low back down " +
  "more never always again together better bad good sweet bitter cold warm kiss touch feel know want need call " +
  "money power glory shadow ghost angel devil heaven hell paradise ocean wave storm thunder lightning echo silence " +
  "voice song music radio party club drive ride highway desert island mountain valley garden flower rose violet"
).split(" ");

/** Un tirage pseudo-aléatoire déterministe (mulberry32). */
function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T>(rnd: () => number, list: readonly T[]): T => list[Math.floor(rnd() * list.length)]!;
const title = (rnd: () => number, n: number) => {
  const words = Array.from({ length: 1 + Math.floor(rnd() * 4) }, () => pick(rnd, WORDS));
  // Sept titres sur dix sans marque : des homonymes à foison, comme une vraie bibliothèque (« Home », « Love Song »).
  return `${words.join(" ")}${rnd() < 0.3 ? ` ${n.toString(36)}` : ""}`.replace(/^./, (c) => c.toUpperCase());
};

// La FTS dérive son rowid du DÉBUT de l'identifiant : des débuts distincts.
const id = (n: number) => n.toString(16).padStart(8, "0").padEnd(32, "b");

export function libraryOf(size: number): IndexRow[] {
  const rnd = random(42);
  const artists = Array.from({ length: Math.max(10, Math.floor(size / 12)) }, (_, i) => `${pick(rnd, WORDS)} ${pick(rnd, WORDS)} ${i}`);
  return Array.from({ length: size }, (_, n) => {
    const artist = pick(rnd, artists);
    return {
      id: id(n + 1), kind: "track", name: title(rnd, n), sortName: `s${n}`, albumId: null, albumName: `Album ${n % 997}`, albumArtist: artist,
      artists: [{ id: null, name: artist, mbid: null }], year: null, trackNumber: null, discNumber: null, durationMs: 120_000 + Math.floor(rnd() * 240_000),
      recordingMbid: null, releaseMbid: null, releaseGroupMbid: null, artistMbid: null, format: null, sizeBytes: null, normalizationGain: null,
      imageTag: null, childCount: null, dateCreated: null,
    } as unknown as IndexRow;
  });
}

/** Une playlist de `size` titres : une part `inLibrary` tirée de la bibliothèque, le reste inconnu (mots partagés). */
export function playlistOf(library: readonly IndexRow[], size: number, inLibrary: number): ImportedPlaylist {
  const rnd = random(size);
  const tracks: ImportedTrack[] = Array.from({ length: size }, (_, index) => {
    if (rnd() < inLibrary) {
      const row = pick(rnd, library) as IndexRow & { name: string };
      return { index, title: row.name, artists: row.artists.map((a) => a.name), album: row.albumName, durationMs: row.durationMs, isrc: null, sourceId: `s:${index}`, artworkUrl: `https://i.scdn.co/image/${index}` };
    }
    return { index, title: title(rnd, 1_000_000 + index), artists: [`${pick(rnd, WORDS)} ${pick(rnd, WORDS)}`], album: `Ailleurs ${index % 300}`, durationMs: 200_000, isrc: null, sourceId: `s:${index}`, artworkUrl: `https://i.scdn.co/image/${index}` };
  });
  return { source: "spotify", name: `Géante ${size}`, tracks, truncated: false, artworkUrl: null };
}
