/**
 * Octave — la DERNIÈRE playlist utilisée sur cet appareil : la cible du « + » (ajout rapide). Une commodité
 * d'appareil (`localStorage`, lecture et écriture protégées) : sans elle, le « + » demande la playlist.
 */

// Clé de stockage : traversée par une chaîne, elle ne se renomme jamais.
const KEY = "tentacle_octave_last_playlist";

export function lastPlaylistId(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function rememberPlaylist(playlistId: string): void {
  try {
    localStorage.setItem(KEY, playlistId);
  } catch {
    /* stockage refusé : le « + » demandera la playlist */
  }
}

/** La cible du « + » : la dernière playlist utilisée si elle existe encore et se modifie ; sinon `null`. */
export function quickTarget<P extends { jellyfinId: string; editable: boolean }>(playlists: readonly P[], lastId: string | null): P | null {
  return (lastId && playlists.find((p) => p.jellyfinId === lastId && p.editable)) || null;
}
