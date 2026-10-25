/**
 * Octave — « une scène couvre tout ». Le lecteur plein écran est opaque et
 * couvre les pages : la houle d'une rangée dessous reste « à l'écran » pour
 * l'IntersectionObserver, mais personne ne la voit. Tant qu'une ambiance est
 * montée, toutes les houles se suspendent (`still`) — ce qui n'est pas
 * affiché ne consomme rien.
 */

import { useEffect, useSyncExternalStore } from "react";

let covers = 0;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Les pages sont-elles couvertes, maintenant ? */
export const pagesCovered = (): boolean => covers > 0;

/** Une scène qui couvre tout se déclare le temps qu'elle est montée. */
export function coverPages(): () => void {
  covers += 1;
  emit();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    covers -= 1;
    emit();
  };
}

export function useCoverPages(): void {
  useEffect(() => coverPages(), []);
}

/** Les pages sont-elles couvertes (par le lecteur plein écran) ? */
export function usePagesCovered(): boolean {
  return useSyncExternalStore(subscribe, pagesCovered, pagesCovered);
}
