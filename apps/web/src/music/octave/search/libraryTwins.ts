/**
 * Octave — les JUMEAUX : un titre (ou un album, un artiste) de l'extension qui EST déjà dans la bibliothèque.
 * La bibliothèque gagne : il se lit tout de suite, sans rien demander. Avec des MBID des deux côtés, c'est
 * `useOctaveSearch` qui les retire ; ici, la règle GÉNÉRIQUE sans MBID (contrat, CONTRATS.md) : même titre
 * normalisé, même premier artiste, et — si les deux la connaissent — une durée à ± 3 s. Règle pure.
 */

import type { MusicAlbum, MusicArtist, MusicTrack } from "@tentacle-tv/shared/music";

const DURATION_GAP_MS = 3_000;

/** Casse, accents, ponctuation et espaces mis de côté (« Feel Good Inc. » = « feel good inc »). */
export function twinText(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’`]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

const firstArtist = (artists: readonly { name: string }[]) => twinText(artists[0]?.name ?? "");

export function sameTrack(a: MusicTrack, b: MusicTrack): boolean {
  if (twinText(a.title) !== twinText(b.title) || firstArtist(a.artists) !== firstArtist(b.artists)) return false;
  if (a.durationMs !== null && b.durationMs !== null && Math.abs(a.durationMs - b.durationMs) > DURATION_GAP_MS) return false;
  return true;
}

export const sameAlbum = (a: MusicAlbum, b: MusicAlbum): boolean => twinText(a.title) === twinText(b.title) && firstArtist(a.artists) === firstArtist(b.artists);
export const sameArtist = (a: MusicArtist, b: MusicArtist): boolean => twinText(a.name) === twinText(b.name);

/** Le jumeau de bibliothèque d'un élément de l'extension, s'il y en a un. */
export function libraryTwin<T>(item: T, library: readonly T[], same: (a: T, b: T) => boolean): T | null {
  return library.find((own) => same(own, item)) ?? null;
}

/** Les éléments de l'extension qui n'ont PAS de jumeau dans la bibliothèque, dans leur ordre. */
export function withoutTwins<T>(external: readonly T[], library: readonly T[], same: (a: T, b: T) => boolean): T[] {
  return external.filter((item) => libraryTwin(item, library, same) === null);
}
