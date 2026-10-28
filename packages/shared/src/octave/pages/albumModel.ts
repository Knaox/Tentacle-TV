/**
 * Octave — les règles PURES de la page d'un album : l'ordre disque puis piste,
 * la meilleure qualité de la parution, la date de sortie en toutes lettres.
 * Web, bureau et mobile.
 */

import type { MusicAudioFormat, MusicTrack } from "../../music";

/** La meilleure qualité de l'album (sans perte d'abord, puis profondeur et fréquence). */
export function bestFormat(tracks: readonly MusicTrack[]): MusicAudioFormat | null {
  let best: MusicAudioFormat | null = null;
  const score = (f: MusicAudioFormat) => (f.lossless ? 1e9 : 0) + (f.bitDepth ?? 0) * 1e6 + (f.sampleRate ?? 0) + (f.bitrate ?? 0) / 1e3;
  for (const t of tracks) if (t.format && (!best || score(t.format) > score(best))) best = t.format;
  return best;
}

/** Les titres dans l'ordre disque puis piste, et les disques présents. */
export function inDiscOrder(tracks: readonly MusicTrack[]): { ordered: MusicTrack[]; discs: number[] } {
  const ordered = [...tracks].sort((a, b) => (a.discNumber ?? 1) - (b.discNumber ?? 1) || (a.trackNumber ?? 0) - (b.trackNumber ?? 0));
  return { ordered, discs: [...new Set(ordered.map((x) => x.discNumber ?? 1))] };
}

/** Une date `AAAA-MM-JJ` en toutes lettres ; une date partielle (`AAAA`, `AAAA-MM`) n'en est pas une. */
export function longReleaseDate(date: string | null, locale: string): string | null {
  if (!date || !/^\d{4}-\d{2}-\d{2}/.test(date)) return null;
  const parsed = new Date(`${date.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(parsed);
}
