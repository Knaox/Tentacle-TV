/**
 * Le réglage « Transition douce » d'Octave sur le web et le bureau : le magasin PARTAGÉ
 * (`@tentacle-tv/shared/octave` → `createCrossfadeSetting`, allumé à 5 s d'office) sur le `localStorage` de la
 * page. Lu par le fournisseur du moteur, qui le passe au port (`setCrossfade`), par le contrôle du lecteur et
 * par la ligne des Réglages d'Octave.
 */

import { useSyncExternalStore } from "react";
import { createCrossfadeSetting } from "@tentacle-tv/shared/octave";

export { CROSSFADE_STORAGE_KEY } from "@tentacle-tv/shared/octave";

const store = createCrossfadeSetting(() => {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
});

export const getCrossfadeMs = (): number => store.get();

export function setCrossfadeMs(next: number): void {
  store.set(next);
}

export const subscribeCrossfade = store.subscribe;

export function useCrossfadeMs(): number {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}
