/**
 * L'ouverture du dialogue « Garder hors ligne », par un magasin de module :
 * n'importe quel point d'entrée (fiche, ligne d'épisode, saison, série,
 * appui long) demande l'ouverture, la feuille — montée UNE fois dans
 * `OfflineShell` — s'affiche. Une feuille par requête, jamais deux modales
 * imbriquées : l'appui long ferme la sienne avant, et l'ouverture est différée
 * après les interactions en cours.
 */

import { InteractionManager } from "react-native";
import { useSyncExternalStore } from "react";
import type { MediaItem } from "@tentacle-tv/shared";

export type KeepOfflineMode = "single" | "season" | "series" | "selection";

export interface KeepOfflineRequest {
  mode: KeepOfflineMode;
  /** Les titres (films ou épisodes) — pour une série, TOUS ses épisodes. */
  items: MediaItem[];
  seriesId?: string;
  /** Titre d'en-tête (nom du film, de la série…). */
  title?: string;
}

/** Laisse la feuille précédente se refermer avant d'en présenter une autre (iOS). */
const OPEN_DELAY_MS = 120;

let current: KeepOfflineRequest | null = null;
const listeners = new Set<() => void>();

const notify = (): void => {
  for (const listener of listeners) listener();
};

export function openKeepOffline(request: KeepOfflineRequest): void {
  InteractionManager.runAfterInteractions(() => {
    setTimeout(() => {
      current = request;
      notify();
    }, OPEN_DELAY_MS);
  });
}

export function closeKeepOffline(): void {
  if (current === null) return;
  current = null;
  notify();
}

const getSnapshot = (): KeepOfflineRequest | null => current;

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useKeepOfflineRequest(): KeepOfflineRequest | null {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
