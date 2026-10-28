/**
 * Octave (mobile) — le lecteur plein écran ouvert ou fermé : un magasin minimal, lu par le mini-lecteur (qui
 * l'ouvre) et par le lecteur (posé en recouvrement de la coquille). Un écran qui veut ouvrir le lecteur
 * (« Lecture » d'un album, par exemple) appelle `openNowPlaying()`.
 */

import { useSyncExternalStore } from "react";
import { ValueStore } from "@tentacle-tv/shared/octave";

const store = new ValueStore<boolean>(false);

export const openNowPlaying = (): void => store.set(true);
export const closeNowPlaying = (): void => store.set(false);
export const isNowPlayingOpen = (): boolean => store.get();

export function useNowPlayingOpen(): boolean {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}
