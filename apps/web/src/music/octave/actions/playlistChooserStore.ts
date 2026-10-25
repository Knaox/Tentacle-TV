/**
 * Octave — la demande en cours du sélecteur de playlist (playlistChooser.tsx) : quels titres (un, ou une
 * sélection), et s'il vient d'entrer dans une playlist d'où « Changer » le déplacera. Un magasin minuscule, lu par `useSyncExternalStore`.
 */

import type { MusicPlaylist, MusicTrack } from "@tentacle-tv/shared/music";

export interface ChooserRequest {
  /** Un titre, ou les titres d'une sélection (dans l'ordre de la liste). */
  tracks: readonly MusicTrack[];
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
  current = { tracks: [track], moveFrom };
  notify();
}

/** Le choix pour une SÉLECTION : « Ajouter 5 titres à… », « Nouvelle playlist… » compris. */
export function openPlaylistChooserForMany(tracks: readonly MusicTrack[]): void {
  if (tracks.length === 0) return;
  current = { tracks, moveFrom: null };
  notify();
}

export function closePlaylistChooser(): void {
  current = null;
  notify();
}
