/**
 * « Tenir à jour les playlists gardées sur cet appareil » — un réglage de
 * l'APPAREIL (jamais du compte), éteint par défaut. Clé neuve, qui ne se renomme
 * pas : `tentacle_octave_offline_autosync` (« 1 » allumé, absente éteint).
 */

import { useSyncExternalStore } from "react";

export const AUTOSYNC_STORAGE_KEY = "tentacle_octave_offline_autosync";

const listeners = new Set<() => void>();

function read(): boolean {
  try {
    return localStorage.getItem(AUTOSYNC_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function isAutoSyncOn(): boolean {
  return read();
}

export function setAutoSync(on: boolean): void {
  try {
    if (on) localStorage.setItem(AUTOSYNC_STORAGE_KEY, "1");
    else localStorage.removeItem(AUTOSYNC_STORAGE_KEY);
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
  return useSyncExternalStore(subscribe, read, () => false);
}
