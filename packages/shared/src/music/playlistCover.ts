/**
 * Octave — ce qu'une jaquette de playlist MONTRE, la même règle pour le web, le bureau et le mobile (et « Sur cet
 * appareil », qui passe les pochettes gardées choisies par `keptPlaylistArt.ts`). Le CHOIX des albums est
 * `musicMosaic.ts` (cœur et hors ligne) ; ici, ce qu'un client en fait :
 *
 * - les images d'une playlist : sa mosaïque du jour (`MusicPlaylist.mosaic`), sinon son image Jellyfin (posée à la
 *   main, ou un serveur d'avant), sinon rien ;
 * - la mise en page : quatre images → une grille 2 × 2 bord à bord, que le CADRE arrondit (jamais une case arrondie
 *   à part, jamais un séparateur) ; moins de quatre → UNE pochette, la première ; aucune → le repli du client (teinte,
 *   icône). Une case `null` (pochette absente du disque, hors ligne) reste une case : le repli du client la teinte.
 *
 * Avant le 29/10, le mobile montrait l'image de Jellyfin (son collage figé des premiers titres) et le bureau la
 * mosaïque : deux jaquettes différentes pour la même playlist. Une seule règle désormais.
 */

import type { MusicPlaylist } from "./musicTypes";

/** Les images à montrer pour une playlist : sa mosaïque, sinon son image (peut-être aucune). */
export function playlistCoverUrls(playlist: Pick<MusicPlaylist, "mosaic" | "artworkUrl">): string[] {
  if (playlist.mosaic && playlist.mosaic.length > 0) return playlist.mosaic;
  return playlist.artworkUrl ? [playlist.artworkUrl] : [];
}

export type PlaylistCoverLayout<T extends string | null = string | null> =
  | { kind: "single"; url: T | null }
  | { kind: "grid"; cells: readonly [T, T, T, T] };

/** La mise en page d'une jaquette : 2 × 2 à partir de quatre images, sinon la première seule (ou rien). */
export function playlistCoverLayout<T extends string | null>(urls: readonly T[]): PlaylistCoverLayout<T> {
  if (urls.length < 4) return { kind: "single", url: urls[0] ?? null };
  return { kind: "grid", cells: [urls[0]!, urls[1]!, urls[2]!, urls[3]!] };
}
