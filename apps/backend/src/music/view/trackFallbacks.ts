/**
 * Octave — ce qu'un titre de la bibliothèque emprunte à son album et à ses
 * artistes quand Jellyfin ne le lui donne pas (Damien, 27/10 : « des titres
 * liés à aucun album, ou sans image »). Lu à chaque vue, jamais figé dans
 * l'index : la pochette ou le nom arrivé plus tard se voit aussitôt.
 *
 * - L'image : la sienne, sinon celle de son album, sinon celle d'un de ses
 *   artistes (dans l'ordre du crédit) — le client dessine son repli neutre
 *   seulement quand aucun n'en a.
 * - L'album : un titre qui porte un `AlbumId` sans nom d'album reprend le nom
 *   de l'album indexé, et donc son lien.
 */

import { rowsByIds } from "../index/indexQueries";
import type { IndexRow } from "../index/indexTypes";

function needsAlbum(row: IndexRow): boolean {
  return row.albumId !== null && (!row.imageTag || !row.albumName);
}

function needsArtist(row: IndexRow): boolean {
  return !row.imageTag && row.artists.some((a) => a.id);
}

/** Pur : le titre complété par les lignes de son album et de ses artistes (`related`). */
export function withFallbacks(row: IndexRow, related: ReadonlyMap<string, IndexRow>): IndexRow {
  if (row.imageTag && row.albumName) return row;
  const album = row.albumId ? related.get(row.albumId) : undefined;
  const albumName = row.albumName ?? (album?.kind === "album" ? album.name : null);
  let imageTag = row.imageTag || (album?.kind === "album" ? album.imageTag : null);
  for (const artist of row.artists) {
    if (imageTag) break;
    const found = artist.id ? related.get(artist.id) : undefined;
    if (found?.kind === "artist") imageTag = found.imageTag;
  }
  return imageTag === row.imageTag && albumName === row.albumName ? row : { ...row, albumName, imageTag };
}

/** Les titres complétés, en une seule lecture de l'index pour tous. */
export async function tracksWithFallbacks(tracks: readonly IndexRow[]): Promise<IndexRow[]> {
  const ids = new Set<string>();
  for (const row of tracks) {
    if (needsAlbum(row)) ids.add(row.albumId!);
    if (needsArtist(row)) for (const a of row.artists) if (a.id) ids.add(a.id);
  }
  if (ids.size === 0) return [...tracks];
  const related = await rowsByIds([...ids]);
  return tracks.map((row) => withFallbacks(row, related));
}
