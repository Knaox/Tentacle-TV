/**
 * Octave mobile — la feuille d'actions d'un album, d'un artiste ou d'une playlist ouverte (appui maintenu
 * d'une carte ou d'une rangée, « ⋯ ») : quel élément, et la rubrique de la bibliothèque où il est montré
 * (l'ordre ne se règle que là), et ce que la page fait de « Réordonner ». Un magasin minuscule : l'hôte des
 * pages rend la feuille.
 */

import { useSyncExternalStore } from "react";
import type { LibraryShelf, MusicShelfSubject } from "@tentacle-tv/api-client";

export type CollectionSheetShelf = Pick<LibraryShelf<unknown>, "ordered" | "atTop" | "canReorder" | "moveToTop">;

export interface CollectionSheetRequest {
  subject: MusicShelfSubject;
  /** La rubrique de la bibliothèque où l'élément est montré ; absente ailleurs (accueil, recherche) : pas d'ordre. */
  shelf?: CollectionSheetShelf;
  /** « Réordonner » : la page passe en mode glisser sur la section de l'élément. */
  onReorder?: () => void;
}

let current: CollectionSheetRequest | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function openCollectionSheet(request: CollectionSheetRequest): void {
  current = request;
  emit();
}

export function closeCollectionSheet(): void {
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
export const readCollectionSheet = read;

export function useCollectionSheet(): CollectionSheetRequest | null {
  return useSyncExternalStore(subscribe, read, read);
}
