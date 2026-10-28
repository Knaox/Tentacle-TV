/**
 * Octave (mobile) — le geste « lire » des vues de la musique gardée (« Sur cet
 * appareil ») : le lecteur d'Octave (m2) s'y inscrit une fois
 * (`setKeptPlayHandler(player.playList)`), les vues n'en importent rien. Sans
 * lecteur inscrit, toucher un titre ne fait rien (jamais une erreur).
 */

import type { MusicTrack } from "@tentacle-tv/shared/music";

export type KeptPlayHandler = (tracks: readonly MusicTrack[], index: number, contextId: string) => void;

let handler: KeptPlayHandler | null = null;

export function setKeptPlayHandler(next: KeptPlayHandler | null): void {
  handler = next;
}

export function playKept(tracks: readonly MusicTrack[], index: number, contextId: string): boolean {
  if (!handler || tracks.length === 0) return false;
  handler(tracks, index, contextId);
  return true;
}
