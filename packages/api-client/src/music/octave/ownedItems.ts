/**
 * Octave — ce qui est montré hors bibliothèque et que la bibliothèque A (`POST /api/music/match`). Règle pure :
 * - un TITRE est remplacé par celui de la bibliothèque : montré et JOUÉ comme lui (clé `jf:`, source, cœur) ;
 * - un ALBUM entièrement présent devient celui de la bibliothèque (sa carte ouvre sa vue) ; en partie présent,
 *   il reste celui d'ailleurs, marqué « en partie ».
 */

import type { LibraryAlbumMatch } from "../useMusicLibraryMatch";
import type { MusicAlbum, MusicTrack } from "@tentacle-tv/shared/music";

/** `full` : l'album de la bibliothèque ; `partial` : celui d'ailleurs, dont une partie est déjà là. */
export type AlbumOwnership = "full" | "partial";

export interface ShownAlbum {
  album: MusicAlbum;
  ownership: AlbumOwnership | null;
}

/** Chaque titre, ou celui de la bibliothèque qui l'est ; la même liste (même référence) si rien ne change. */
export function ownedTracks(tracks: readonly MusicTrack[], owned: ReadonlyMap<string, MusicTrack>): readonly MusicTrack[] {
  if (owned.size === 0) return tracks;
  let changed = false;
  const out = tracks.map((track) => {
    const own = track.jellyfinId === null ? owned.get(track.key) : undefined;
    if (!own) return track;
    changed = true;
    return own;
  });
  return changed ? out : tracks;
}

/** Combien de ces titres sont dans la bibliothèque. */
export const ownedCount = (tracks: readonly MusicTrack[]) => tracks.filter((t) => t.availability === "library").length;

/** Chaque album, ou celui de la bibliothèque s'il y est en entier ; un album d'ailleurs en partie présent est marqué. */
export function ownedAlbums(albums: readonly MusicAlbum[], matches: ReadonlyMap<string, LibraryAlbumMatch>): ShownAlbum[] {
  const seen = new Set<string>();
  const out: ShownAlbum[] = [];
  for (const album of albums) {
    const match = album.jellyfinId === null ? matches.get(album.key) : undefined;
    const shown: ShownAlbum = !match ? { album, ownership: null } : match.coverage === "full" ? { album: match.album, ownership: "full" } : { album, ownership: "partial" };
    // Deux parutions d'ailleurs pour le même album de la bibliothèque : une carte.
    if (seen.has(shown.album.key)) continue;
    seen.add(shown.album.key);
    out.push(shown);
  }
  return out;
}

/** Dans une liste qui MÊLE (recherche) : la pastille d'un album — reconnu, ou de la bibliothèque d'emblée. */
export function searchAlbumOwnership(album: MusicAlbum, marks: ReadonlyMap<string, AlbumOwnership>): AlbumOwnership | null {
  return marks.get(album.key) ?? (album.jellyfinId !== null ? "full" : null);
}
