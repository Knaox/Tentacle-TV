/**
 * Octave mobile — la rangée de titre OUVERTE par un balayage court (« Lire ensuite » ou « Retirer »
 * découvert) : une seule à la fois, avec son côté. En ouvrir une referme la précédente ; défiler, toucher
 * la rangée ou agir la referme.
 */

import { useCallback, useSyncExternalStore } from "react";
import type { TrackSwipeSide } from "./trackSwipe";

let openId: string | null = null;
let openSide: TrackSwipeSide = "right";
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function openSwipe(id: string, side: TrackSwipeSide = "right"): void {
  if (openId === id && openSide === side) return;
  openId = id;
  openSide = side;
  emit();
}

/** Referme la rangée ouverte ; avec `id`, seulement si c'est elle. */
export function closeSwipe(id?: string): void {
  if (openId === null || (id !== undefined && openId !== id)) return;
  openId = null;
  emit();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Le côté découvert de CETTE rangée, `null` si elle est fermée. */
export function useSwipeOpenSide(id: string): TrackSwipeSide | null {
  const read = useCallback(() => (openId === id ? openSide : null), [id]);
  return useSyncExternalStore(subscribe, read, read);
}
