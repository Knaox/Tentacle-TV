/**
 * Octave — la demande de gérer UNE playlist (modifier ses détails, la supprimer), posée par un menu « … » ou
 * un clic droit n'importe où (page, cartes, rail) et servie par UN hôte monté par la coquille. Une demande
 * nouvelle remplace l'ancienne.
 */

import { useSyncExternalStore } from "react";
import type { MusicPlaylist } from "@tentacle-tv/shared/music";

export type PlaylistManageRequest =
  | { kind: "edit"; playlist: MusicPlaylist }
  | { kind: "delete"; playlist: MusicPlaylist }
  /** Le lien de partage (capacité `music.playlistShare`, droit « Partage public »). */
  | { kind: "share"; playlist: MusicPlaylist }
  /** Les personnes d'une playlist partagée entre comptes (capacité `music.playlistMembers`) : la gérer, ou les voir. */
  | { kind: "members"; playlist: MusicPlaylist }
  /** Un membre QUITTE une playlist qu'on lui a partagée (confirmation). */
  | { kind: "leave"; playlist: MusicPlaylist };

let current: PlaylistManageRequest | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export function requestPlaylistManage(request: PlaylistManageRequest): void {
  current = request;
  notify();
}

export function closePlaylistManage(): void {
  current = null;
  notify();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function usePlaylistManageRequest(): PlaylistManageRequest | null {
  return useSyncExternalStore(subscribe, () => current, () => null);
}
