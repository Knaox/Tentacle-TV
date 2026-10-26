/**
 * « Tenir à jour les playlists gardées sur cet appareil » — un réglage de
 * l'APPAREIL (jamais du compte), ALLUMÉ par défaut (Damien, 26/10) : il n'agit que
 * sur les playlists déjà gardées hors ligne, et se coupe. Clé neuve, qui ne se
 * renomme pas : `tentacle_octave_offline_autosync` (« 0 » coupé ; absente ou « 1 » allumé).
 */

import { useSyncExternalStore } from "react";

export const AUTOSYNC_STORAGE_KEY = "tentacle_octave_offline_autosync";

const listeners = new Set<() => void>();

function read(): boolean {
  try {
    return localStorage.getItem(AUTOSYNC_STORAGE_KEY) !== "0";
  } catch {
    // Stockage illisible : le défaut, allumé.
    return true;
  }
}

export function isAutoSyncOn(): boolean {
  return read();
}

export function setAutoSync(on: boolean): void {
  try {
    localStorage.setItem(AUTOSYNC_STORAGE_KEY, on ? "1" : "0");
  } catch {
    /* stockage refusé : le réglage ne survivra pas à la fermeture */
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useAutoSync(): boolean {
  return useSyncExternalStore(subscribe, read, () => true);
}
