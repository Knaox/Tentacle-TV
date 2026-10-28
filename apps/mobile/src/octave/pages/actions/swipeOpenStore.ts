/**
 * Octave mobile — la rangée de titre OUVERTE par un balayage court (« Lire ensuite » découvert) : une seule
 * à la fois. En ouvrir une referme la précédente ; défiler, toucher la rangée ou agir la referme.
 */

import { useCallback, useSyncExternalStore } from "react";

let openId: string | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function openSwipe(id: string): void {
  if (openId === id) return;
  openId = id;
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

export function useIsSwipeOpen(id: string): boolean {
  const read = useCallback(() => openId === id, [id]);
  return useSyncExternalStore(subscribe, read, read);
}
