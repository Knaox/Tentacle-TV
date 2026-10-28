/**
 * Octave — un album qui ne se LIT pas (`MusicAlbum.unavailable`, posé par l'extension : connu ailleurs, absent de
 * YouTube — lot « Octave mobile 3 », 28/10). Sa carte est GRISÉE ; la toucher ouvre une feuille qui dit pourquoi et
 * propose de l'aimer ou de l'ajouter à une playlist : le serveur le récupère (Lidarr). Règle commune au web, au bureau
 * et au mobile ; chaque application ne fait que la rendre.
 *
 * La feuille charge l'album (la route `album` de l'extension) pour en avoir les titres. Ce que la réponse dit :
 * - `ready` : toujours pas lisible, des titres à aimer ou à ajouter ;
 * - `playable` : l'extension l'a trouvé à l'ouverture (la page de recherche n'en montrait qu'une partie) — on ouvre sa
 *   vue comme celle de tout album ;
 * - `lost` : introuvable, ou sans titre — rien à demander, on le dit ;
 * - `failed` : la demande n'a pas abouti — « Réessayer ».
 */

import type { MusicAlbum, MusicTrack } from "../../music/musicTypes";

export type UnavailableAlbumPhase = "loading" | "ready" | "playable" | "lost" | "failed";

/**
 * La carte est-elle grisée ? Jamais un album de la bibliothèque, ni un album que la bibliothèque a (en entier ou en
 * partie) : il s'écoute déjà, sa vue s'ouvre.
 */
export function isUnavailableAlbum(album: Pick<MusicAlbum, "jellyfinId" | "unavailable">, ownership: "full" | "partial" | null = null): boolean {
  return !album.jellyfinId && ownership === null && album.unavailable != null;
}

export interface UnavailableAlbumLoad {
  data: MusicAlbum | null | undefined;
  isPending: boolean;
  isError: boolean;
}

export function unavailableAlbumPhase(load: UnavailableAlbumLoad): UnavailableAlbumPhase {
  if (load.isError) return "failed";
  if (load.isPending) return "loading";
  const album = load.data;
  if (!album) return "lost";
  if (album.unavailable == null) return "playable";
  return (album.tracks?.length ?? 0) > 0 ? "ready" : "lost";
}

/** Les titres que la feuille aime ou ajoute : ceux de la réponse, rien tant qu'elle n'est pas `ready`. */
export function unavailableAlbumTracks(phase: UnavailableAlbumPhase, album: MusicAlbum | null | undefined): readonly MusicTrack[] {
  return phase === "ready" ? (album?.tracks ?? []) : [];
}
