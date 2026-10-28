/**
 * Octave — les JUMEAUX : un titre (ou un album, un artiste) de l'extension qui EST déjà dans la bibliothèque.
 * La bibliothèque gagne : il se lit tout de suite, sans rien demander. Ici, contre les résultats de bibliothèque
 * de la MÊME recherche (aucune requête) ; contre l'index entier, c'est `POST /api/music/match` (`ownedSearch.ts`).
 * La règle est UNE, celle du contrat (`musicLibraryMatch.ts` : MBID, sinon titre de base + artiste commun +
 * durée à ± 2 s).
 */

import { isSameAlbum, type MatchableAlbum, type MusicAlbum, type MusicArtist } from "../../music";
// La règle d'un TITRE est partagée (« Titres likés », ajout en playlist) : `../trackTwins` (`sameTrack`),
// elle-même la règle du contrat (musicLibraryMatch).
import { twinText } from "../trackTwins";

const albumView = (a: MusicAlbum): MatchableAlbum => ({
  title: a.title,
  artists: a.artists,
  release: a.mbids.release,
  releaseGroup: a.mbids.releaseGroup,
  compilation: a.kind === "compilation" || a.kind === "soundtrack",
});

/** `a` : celui de la bibliothèque ; `b` : celui de l'extension. */
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
