/**
 * Octave mobile — la feuille d'actions d'un titre ouverte (au « ⋯ » ou à l'appui
 * maintenu d'une rangée) : quel titre, depuis quelle liste (son contexte et ses
 * voisins, pour « Lire » depuis lui). Un magasin minuscule : l'hôte des pages
 * rend la feuille.
 */

import { useSyncExternalStore } from "react";
import type { MusicTrack } from "@tentacle-tv/shared/music";

export interface TrackSheetRequest {
  track: MusicTrack;
  /** La liste d'où vient le titre (lire depuis lui garde la suite). */
  list: readonly MusicTrack[];
  contextId: string | null;
  /** Sur la page de l'album (ou de l'artiste), « Voir l'album » (« Voir l'artiste ») ne se propose pas. */
  hide?: { album?: boolean; artist?: boolean };
  /** Le titre est DANS une playlist qui permet de le retirer : « Retirer de la playlist », en tête de la feuille. */
  remove?: () => void;
}

let current: TrackSheetRequest | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function openTrackSheet(request: TrackSheetRequest): void {
  current = request;
  emit();
}

export function closeTrackSheet(): void {
  if (!current) return;
  current = null;
  emit();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const read = () => current;

/** La demande en cours (hors React : tests). */
export const readTrackSheet = read;

export function useTrackSheet(): TrackSheetRequest | null {
  return useSyncExternalStore(subscribe, read, read);
}
