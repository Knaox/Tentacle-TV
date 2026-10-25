/**
 * Octave — deux titres JUMEAUX : le même morceau, d'où qu'il vienne (bibliothèque ou extension). Avec des MBID
 * des deux côtés, l'enregistrement fait foi ; sinon la règle générique (CONTRATS.md) : même titre normalisé, même
 * premier artiste, et — si les deux la connaissent — une durée à ± 3 s. Règle pure, partagée par la recherche
 * (libraryTwins.ts du web), « Titres likés » (un titre n'y est jamais deux fois) et l'ajout en playlist (doublon ?).
 */

import type { MusicTrack } from "../music";

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

export const firstArtistText = (artists: readonly { name: string }[]): string => twinText(artists[0]?.name ?? "");

/** Le même titre selon la règle générique (sans MBID). */
export function sameTrack(a: MusicTrack, b: MusicTrack): boolean {
  if (twinText(a.title) !== twinText(b.title) || firstArtistText(a.artists) !== firstArtistText(b.artists)) return false;
  if (a.durationMs !== null && b.durationMs !== null && Math.abs(a.durationMs - b.durationMs) > DURATION_GAP_MS) return false;
  return true;
}

/**
 * Le même morceau : même clé, même élément Jellyfin, même enregistrement MBID, ou jumeaux par la règle générique.
 * Deux MBID DIFFÉRENTS ne suffisent pas à dire « autre morceau » : une extension peut porter une clé à elle à la
 * place du MBID (un titre YouTube Music sans MBID connu) — la règle générique tranche alors.
 */
export function sameRecording(a: MusicTrack, b: MusicTrack): boolean {
  if (a.key === b.key) return true;
  if (a.jellyfinId !== null && a.jellyfinId === b.jellyfinId) return true;
  if (a.mbids.recording && a.mbids.recording === b.mbids.recording) return true;
  return a.title.length > 0 && sameTrack(a, b);
}
