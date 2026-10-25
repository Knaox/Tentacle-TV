/**
 * Octave — deux titres JUMEAUX : le même morceau, d'où qu'il vienne (bibliothèque ou extension). La règle est
 * UNE, celle du contrat (`music/musicLibraryMatch.ts`, appliquée aussi par le cœur, `POST /api/music/match`) :
 * MBID d'enregistrement s'il tranche, sinon titre de base + artiste commun + durée à ± 2 s (« Various Artists »
 * vaut l'artiste si l'album est le même). Ici ses usages sur des `MusicTrack` : la recherche (libraryTwins.ts du
 * web), « Titres likés » (un titre n'y est jamais deux fois) et l'ajout en playlist (doublon ?).
 */

import { isSameTrack, matchText, normalizeMbid, type MatchableTrack, type MusicTrack } from "../music";

/** Casse, accents, ponctuation et espaces mis de côté (« Feel Good Inc. » = « feel good inc »). */
export const twinText = matchText;

export const firstArtistText = (artists: readonly { name: string }[]): string => twinText(artists[0]?.name ?? "");

/** Ce que la règle lit d'un titre ; seul un VRAI MBID d'enregistrement y entre (jamais une clé d'extension). */
export function matchableTrack(track: MusicTrack, withRecording = true): MatchableTrack {
  return {
    title: track.title,
    artists: track.artists,
    albumTitle: track.album?.title ?? null,
    durationMs: track.durationMs,
    recording: withRecording ? normalizeMbid(track.mbids.recording) : null,
    discNumber: track.discNumber,
    trackNumber: track.trackNumber,
  };
}

/** Le même titre selon la règle du contrat (`a` : celui de la bibliothèque s'il y en a un). */
export function sameTrack(a: MusicTrack, b: MusicTrack): boolean {
  return isSameTrack(matchableTrack(a), matchableTrack(b));
}

/**
 * Le même morceau : même clé, même élément Jellyfin, même enregistrement MBID, ou jumeaux par la règle du contrat.
 * Deux MBID DIFFÉRENTS ne suffisent pas à dire « autre morceau » : une extension peut porter une clé à elle à la
 * place du MBID (un titre YouTube Music sans MBID connu) — la règle tranche alors sur le titre, l'artiste, la durée.
 */
export function sameRecording(a: MusicTrack, b: MusicTrack): boolean {
  if (a.key === b.key) return true;
  if (a.jellyfinId !== null && a.jellyfinId === b.jellyfinId) return true;
  if (a.mbids.recording && a.mbids.recording === b.mbids.recording) return true;
  return a.title.length > 0 && isSameTrack(matchableTrack(a, false), matchableTrack(b, false));
}
