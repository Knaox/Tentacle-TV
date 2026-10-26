/**
 * Octave — ce qui RÉVEILLE la tenue à jour, sans relevé en boucle : les évènements
 * `music:*` que le mode reçoit déjà (`useOctaveEvents` les passe ici, une ligne).
 * Une playlist a changé, la bibliothèque a grandi, un titre d'ailleurs a sa version
 * Jellyfin (`music:resolved` la porte : elle sert de jumeau sans requête).
 */

import { externalTrackKey, type MusicEvent, type MusicTrack } from "@tentacle-tv/shared/music";

export type SyncSignal =
  | { kind: "playlist"; playlistId: string }
  | { kind: "library" }
  | { kind: "twin"; externalKey: string; track: MusicTrack | null };

const listeners = new Set<(signal: SyncSignal) => void>();

/** Appelé pour CHAQUE évènement musique du mode ; ne garde que ce qui intéresse la tenue à jour. */
export function signalMusicEvent(event: MusicEvent): void {
  let signal: SyncSignal | null = null;
  if (event.type === "music:playlist") signal = { kind: "playlist", playlistId: event.playlistId };
  else if (event.type === "music:library" && event.added.length > 0) signal = { kind: "library" };
  else if (event.type === "music:resolved") {
    signal = { kind: "twin", externalKey: externalTrackKey({ pluginId: event.pluginId, id: event.externalId }), track: event.track };
  }
  if (signal) for (const listener of listeners) listener(signal);
}

export function onSyncSignal(listener: (signal: SyncSignal) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
