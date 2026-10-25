/**
 * Octave — où mène un titre : son ALBUM et ses ARTISTES (point 11, 25/10). Dans
 * la bibliothèque, l'élément Jellyfin ; d'ailleurs, la vue que l'extension sert
 * (`external`, contrat `music` — docs/octave/CONTRATS.md) ; sinon nulle part :
 * le nom reste écrit, sans lien (une extension d'avant ne casse rien). Règle
 * pure (`trackTargets.test.ts`).
 */

import type { MusicArtistRef, MusicTrack } from "@tentacle-tv/shared/music";
import { entityTarget, octavePaths } from "../octavePaths";

/** L'adresse de l'album du titre, ou null. */
export function albumPathOf(track: Pick<MusicTrack, "album">): string | null {
  const album = track.album;
  if (!album) return null;
  const target = entityTarget({ jellyfinId: album.jellyfinId, external: album.external ?? null });
  return target ? octavePaths.album(target) : null;
}

/** L'adresse d'un artiste crédité, ou null. */
export function artistPathOf(artist: MusicArtistRef): string | null {
  const target = entityTarget({ jellyfinId: artist.jellyfinId, external: artist.external ?? null });
  return target ? octavePaths.artist(target) : null;
}

/** Les artistes crédités qui ont une page, dans l'ordre du crédit (« Voir l'artiste » du menu). */
export function linkedArtistsOf(track: Pick<MusicTrack, "artists">): { name: string; path: string }[] {
  return track.artists.flatMap((artist) => {
    const path = artistPathOf(artist);
    return path ? [{ name: artist.name, path }] : [];
  });
}
