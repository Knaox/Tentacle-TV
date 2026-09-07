/**
 * L'ouverture du dialogue « Garder hors ligne », par un magasin de module :
 * n'importe quel point d'entrée (fiche, ligne d'épisode, saison, série,
 * appui long) demande l'ouverture, la feuille — montée UNE fois dans
 * `OfflineShell` — s'affiche.
 *
 * Jamais deux modales à la fois : l'ouverture ATTEND que plus aucune feuille
 * ne soit montée (`whenNoModal`). Le report d'avant — `runAfterInteractions`
 * plus 120 ms — ne tenait pas : une animation `useNativeDriver: true` ne crée
 * aucun handle d'interaction, le rappel partait bien avant la fin du ressort
 * de sortie, et les deux modales se recouvraient — écran figé.
 */

import { useSyncExternalStore } from "react";
import { whenNoModal } from "@/components/ui/modalGate";
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

let current: KeepOfflineRequest | null = null;
const listeners = new Set<() => void>();

const notify = (): void => {
  for (const listener of listeners) listener();
};

export function openKeepOffline(request: KeepOfflineRequest): void {
  whenNoModal(() => {
    current = request;
    notify();
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
