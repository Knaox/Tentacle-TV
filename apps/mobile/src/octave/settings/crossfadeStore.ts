/**
 * Octave (mobile) — « Transition douce » : le magasin PARTAGÉ (`@tentacle-tv/shared/octave` ›
 * `createCrossfadeSetting` : clé `tentacle_octave_crossfade`, ALLUMÉE à 3 s sur un appareil qui n'a rien choisi,
 * « 0 » = coupée) sur le stockage préchargé de l'app. La page « Réglages d'Octave » et le contrôle du lecteur
 * l'écrivent, le moteur le lit.
 *
 * ⚠️ Lot « Octave mobile » : m2-audio annonce son pendant (`src/octave/audio/crossfadeSetting.ts`) — à
 * l'intégration, UN seul des deux reste, l'autre le réexporte.
 */

import { useSyncExternalStore } from "react";
import { CROSSFADE_DEFAULT_MS, CROSSFADE_MAX_S, CROSSFADE_MIN_S, CROSSFADE_STORAGE_KEY, createCrossfadeSetting } from "@tentacle-tv/shared/octave";
import { deviceStorage, onDeviceStorageReady } from "./deviceSetting";

export { CROSSFADE_DEFAULT_MS, CROSSFADE_MAX_S, CROSSFADE_MIN_S, CROSSFADE_STORAGE_KEY };

let store = createCrossfadeSetting(deviceStorage);
const listeners = new Set<() => void>();
const notify = () => {
  for (const listener of [...listeners]) listener();
};
let detach = store.subscribe(notify);

// Le stockage prêt (hydraté) : le magasin relit sa clé — lu avant, il n'aurait vu que le défaut.
onDeviceStorageReady(() => {
  const before = store.get();
  detach();
  store = createCrossfadeSetting(deviceStorage);
  detach = store.subscribe(notify);
  if (store.get() !== before) notify();
});

export const getCrossfadeMs = (): number => store.get();
export const setCrossfadeMs = (next: number): void => store.set(next);

export function subscribeCrossfade(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useCrossfadeMs(): number {
  return useSyncExternalStore(subscribeCrossfade, getCrossfadeMs, getCrossfadeMs);
}
