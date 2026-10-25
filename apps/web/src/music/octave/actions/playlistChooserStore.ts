/**
 * Octave — la demande en cours du sélecteur de playlist (playlistChooser.tsx) : quel titre, et s'il vient
 * d'entrer dans une playlist d'où « Changer » le déplacera. Un magasin minuscule, lu par `useSyncExternalStore`.
 */

import type { MusicPlaylist, MusicTrack } from "@tentacle-tv/shared/music";

export interface ChooserRequest {
  track: MusicTrack;
  /** « Changer » : le titre vient d'entrer dans cette playlist ; en choisir une autre l'y déplace. */
  moveFrom: MusicPlaylist | null;
}

let current: ChooserRequest | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export const chooserSnapshot = (): ChooserRequest | null => current;

export function subscribeChooser(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function openPlaylistChooser(track: MusicTrack, moveFrom: MusicPlaylist | null = null): void {
  current = { track, moveFrom };
  notify();
}

export function closePlaylistChooser(): void {
  current = null;
  notify();
}
