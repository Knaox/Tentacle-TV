/**
 * Octave — ce qui RÉVEILLE la tenue à jour, sans relevé en boucle : les évènements
 * `music:*` que le mode reçoit déjà (`useOctaveEvents` les passe ici, une ligne).
 * Une playlist a changé, la bibliothèque a grandi, un titre d'ailleurs a sa version
 * Jellyfin (`music:resolved` la porte : elle sert de jumeau sans requête), les
 * attentes de l'extension ont changé (`music:pending` : un titre ajouté à une
 * playlist importée, une entrée retirée, une entrée qui change d'identité).
 */

import { externalTrackKey, type MusicEvent, type MusicTrack } from "@tentacle-tv/shared/music";
import { LIKED_PLAYLIST_ID } from "./syncInputs";

export type SyncSignal =
  | { kind: "playlist"; playlistId: string }
  | { kind: "library" }
  | { kind: "twin"; externalKey: string; track: MusicTrack | null }
  | { kind: "pending" };

const listeners = new Set<(signal: SyncSignal) => void>();

/** Appelé pour CHAQUE évènement musique du mode ; ne garde que ce qui intéresse la tenue à jour. */
export function signalMusicEvent(event: MusicEvent): void {
  let signal: SyncSignal | null = null;
  if (event.type === "music:playlist") signal = { kind: "playlist", playlistId: event.playlistId };
  // Un cœur posé ou retiré : « Titres likés », si elle est gardée, se relit (`LIKED_PLAYLIST_ID`).
  else if (event.type === "music:userdata" && event.changes.length > 0) signal = { kind: "playlist", playlistId: LIKED_PLAYLIST_ID };
  // Un ajout, ou une MISE À JOUR : Jellyfin pose souvent un titre avant d'en lire les étiquettes (artiste, durée) —
  // c'est la mise à jour qui le rend reconnaissable comme la version d'une copie d'ailleurs (vu au banc).
  else if (event.type === "music:library" && event.added.length + event.updated.length > 0) signal = { kind: "library" };
  else if (event.type === "music:pending") signal = { kind: "pending" };
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
