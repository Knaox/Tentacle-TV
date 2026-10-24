/**
 * Octave — le MODE de l'application, comme le mode hors ligne : allumé, l'app
 * s'ouvre sur l'interface musique (`/octave`) et y revient au prochain
 * lancement ; éteint, l'interface d'avant, intacte.
 *
 * Préférence d'APPAREIL (une fenêtre, un navigateur) : `tentacle_octave_mode`.
 * Clé de stockage : elle ne se renomme jamais.
 */

import { useSyncExternalStore } from "react";

export const OCTAVE_MODE_KEY = "tentacle_octave_mode";
export const OCTAVE_BASE_PATH = "/octave";

const listeners = new Set<() => void>();

function read(): boolean {
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem(OCTAVE_MODE_KEY) === "1";
  } catch {
    return false;
  }
}

let current = read();

export function isOctaveMode(): boolean {
  return current;
}

export function setOctaveMode(on: boolean): void {
  if (on === current) return;
  current = on;
  try {
    if (on) localStorage.setItem(OCTAVE_MODE_KEY, "1");
    else localStorage.removeItem(OCTAVE_MODE_KEY);
  } catch {
    /* stockage refusé : le mode vaut pour cette session seulement */
  }
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useOctaveMode(): boolean {
  return useSyncExternalStore(subscribe, isOctaveMode, () => false);
}
