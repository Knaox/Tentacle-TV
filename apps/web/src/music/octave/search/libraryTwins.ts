/**
 * Octave — les JUMEAUX : un titre (ou un album, un artiste) de l'extension qui EST déjà dans la bibliothèque.
 * La bibliothèque gagne : il se lit tout de suite, sans rien demander. Ici, contre les résultats de bibliothèque
 * de la MÊME recherche (aucune requête) ; contre l'index entier, c'est `POST /api/music/match` (`ownedSearch.ts`).
 * La règle est UNE, celle du contrat (`musicLibraryMatch.ts` : MBID, sinon titre de base + artiste commun +
 * durée à ± 2 s).
 */

import { isSameAlbum, isSameTrack, matchText, type MatchableAlbum, type MatchableTrack, type MusicAlbum, type MusicArtist, type MusicTrack } from "@tentacle-tv/shared/music";

/** Casse, accents, ponctuation et espaces mis de côté (« Feel Good Inc. » = « feel good inc »). */
export const twinText = matchText;

const trackView = (t: MusicTrack): MatchableTrack => ({
  title: t.title,
  artists: t.artists,
  albumTitle: t.album?.title ?? null,
  durationMs: t.durationMs,
  recording: t.mbids.recording,
  discNumber: t.discNumber,
  trackNumber: t.trackNumber,
});

const albumView = (a: MusicAlbum): MatchableAlbum => ({
  title: a.title,
  artists: a.artists,
  release: a.mbids.release,
  releaseGroup: a.mbids.releaseGroup,
  compilation: a.kind === "compilation" || a.kind === "soundtrack",
});

/** `a` : celui de la bibliothèque ; `b` : celui de l'extension. */
export const sameTrack = (a: MusicTrack, b: MusicTrack): boolean => isSameTrack(trackView(a), trackView(b));
export const sameAlbum = (a: MusicAlbum, b: MusicAlbum): boolean => isSameAlbum(albumView(a), albumView(b));
export const sameArtist = (a: MusicArtist, b: MusicArtist): boolean => (a.mbid && b.mbid ? a.mbid === b.mbid : twinText(a.name) === twinText(b.name));

/** Le jumeau de bibliothèque d'un élément de l'extension, s'il y en a un. */
export function libraryTwin<T>(item: T, library: readonly T[], same: (a: T, b: T) => boolean): T | null {
  return library.find((own) => same(own, item)) ?? null;
}

/** Les éléments de l'extension qui n'ont PAS de jumeau dans la bibliothèque, dans leur ordre. */
export function withoutTwins<T>(external: readonly T[], library: readonly T[], same: (a: T, b: T) => boolean): T[] {
  return external.filter((item) => libraryTwin(item, library, same) === null);
}
