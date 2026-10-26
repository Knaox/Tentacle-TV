/**
 * Octave — ce qu'une playlist SUPPRIMÉE libère sur l'appareil (pur). Règle de Damien : supprimer une playlist
 * ne supprime JAMAIS un titre du serveur ; sur l'appareil, seule part la copie gardée UNIQUEMENT à cause de
 * cette playlist (playlist gardée hors ligne). Un titre qu'un album gardé, une autre playlist gardée, les likés
 * gardés ou un titre gardé seul retiennent encore reste là (`isHeld`, la règle de la tenue à jour).
 */

import type { KeptMusicCollection, KeptMusicTrack } from "@tentacle-tv/offline-core";
import { isHeld } from "../offline/autosync/syncPlan";

export interface OfflineRelease {
  /** La collection de l'appareil qui gardait la playlist. */
  collectionKey: string;
  /** Les fichiers de l'appareil que plus rien ne retient. */
  fileIds: number[];
}

/** La clé de collection d'une playlist gardée (`KeepCollectionButton` : `playlist:jf:<id>`). */
export function keptPlaylistKey(playlistId: string): string {
  return `playlist:jf:${playlistId}`;
}

export function offlineReleaseOf(playlistId: string, collections: readonly KeptMusicCollection[], tracks: readonly KeptMusicTrack[]): OfflineRelease | null {
  const fold = (id: string) => id.replace(/-/g, "").toLowerCase();
  const own = collections.find((c) => c.kind === "playlist" && c.key.startsWith("playlist:jf:") && fold(c.key.slice("playlist:jf:".length)) === fold(playlistId));
  if (!own) return null;
  const free = new Set(own.trackKeys.filter((key) => !isHeld(key, collections, own.key)));
  return { collectionKey: own.key, fileIds: tracks.filter((t) => free.has(t.trackKey)).map((t) => t.fileId) };
}
