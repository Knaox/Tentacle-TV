/**
 * Octave (mobile) — le réglage « Transition douce » de l'appareil : le magasin PARTAGÉ avec le web et le bureau
 * (`createCrossfadeSetting`, allumé à 5 s d'office), sur le stockage préchargé de l'app (`RNStorageAdapter`,
 * clé `tentacle_octave_crossfade` dans sa liste). Le fournisseur du moteur y branche le stockage au montage ;
 * le contrôle du lecteur et la page Réglages d'Octave (`m7`) lisent et écrivent par `useCrossfadeMs` /
 * `setCrossfadeMs`.
 */

import { useSyncExternalStore } from "react";
import { createCrossfadeSetting, type SyncStorage } from "@tentacle-tv/shared/octave";

let storage: SyncStorage | null = null;

const store = createCrossfadeSetting(() => storage);

/** Le stockage de l'app (hydraté avant le premier rendu). */
export function bindCrossfadeStorage(next: SyncStorage): void {
  storage = next;
}

export const getCrossfadeMs = (): number => store.get();
export const setCrossfadeMs = (next: number): void => store.set(next);
export const subscribeCrossfade = store.subscribe;

export function useCrossfadeMs(): number {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}
