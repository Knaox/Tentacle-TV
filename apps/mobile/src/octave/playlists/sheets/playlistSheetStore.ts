/**
 * Octave mobile — la feuille de playlist ouverte : gérer (renommer, partager, supprimer), créer, partager,
 * importer (un lien collé, ou celui d'un ami ouvert par `tentacle://octave/import?share=…`). Un magasin
 * minuscule ; l'hôte des playlists la rend. Une demande nouvelle remplace l'ancienne.
 */

import { useSyncExternalStore } from "react";
import type { MusicPlaylist } from "@tentacle-tv/shared/music";

export type PlaylistSheet =
  | { kind: "manage"; playlist: MusicPlaylist }
  | { kind: "rename"; playlist: MusicPlaylist }
  | { kind: "share"; playlist: MusicPlaylist }
  /** Les personnes d'une playlist partagée entre comptes : la gérer (propriétaire), les voir et la quitter (membre). */
  | { kind: "members"; playlist: MusicPlaylist }
  | { kind: "create" }
  /** `autoStart` : un lien reçu par le partage système part sans attendre « Importer ». */
  | { kind: "import"; prefill?: string; autoStart?: boolean };

let current: PlaylistSheet | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function openPlaylistSheet(sheet: PlaylistSheet): void {
  current = sheet;
  emit();
}

export function closePlaylistSheet(): void {
  if (!current) return;
  current = null;
  emit();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const read = () => current;

/** La feuille ouverte (hors React : tests). */
export const readPlaylistSheet = read;

export function usePlaylistSheet(): PlaylistSheet | null {
  return useSyncExternalStore(subscribe, read, read);
}
