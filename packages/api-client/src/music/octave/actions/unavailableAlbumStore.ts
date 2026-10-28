/**
 * Octave — l'album « pas lisible » dont la feuille est ouverte (`unavailableAlbum.ts`, shared) : la carte grisée
 * l'ouvre, la feuille le ferme. Un magasin minuscule lu par `useSyncExternalStore`, le même pour le web, le bureau et
 * le mobile (comme `playlistChooserStore.ts`).
 */

import type { MusicAlbum } from "@tentacle-tv/shared/music";

let current: MusicAlbum | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export const unavailableAlbumSnapshot = (): MusicAlbum | null => current;

export function subscribeUnavailableAlbum(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function openUnavailableAlbum(album: MusicAlbum): void {
  current = album;
  notify();
}

export function closeUnavailableAlbum(): void {
  current = null;
  notify();
}
