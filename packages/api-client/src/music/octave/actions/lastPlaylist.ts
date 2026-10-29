/**
 * Octave — la DERNIÈRE playlist utilisée sur cet appareil : la cible du « + » (ajout rapide). Une commodité
 * d'appareil (stockage passé par l'application, lecture et écriture protégées) : sans elle, le « + » demande la
 * playlist.
 */

import type { OctaveDeviceStore } from "@tentacle-tv/shared/octave";
import { canAddToPlaylist } from "@tentacle-tv/shared/music";

/** Clé de stockage : traversée par une chaîne, elle ne se renomme jamais. */
export const LAST_PLAYLIST_KEY = "tentacle_octave_last_playlist";

export function lastPlaylistIdFrom(store: OctaveDeviceStore | null): string | null {
  try {
    return store?.getItem(LAST_PLAYLIST_KEY) ?? null;
  } catch {
    return null;
  }
}

export function rememberPlaylistIn(store: OctaveDeviceStore | null, playlistId: string): void {
  try {
    store?.setItem(LAST_PLAYLIST_KEY, playlistId);
  } catch {
    /* stockage refusé : le « + » demandera la playlist */
  }
}

/** La cible du « + » : la dernière playlist utilisée si elle existe encore et se modifie ; sinon `null`. */
export function quickTarget<P extends { jellyfinId: string; editable: boolean }>(playlists: readonly P[], lastId: string | null): P | null {
  return (lastId && playlists.find((p) => p.jellyfinId === lastId && canAddToPlaylist(p))) || null;
}
