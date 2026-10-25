/**
 * Octave — le réglage « Au démarrage, ouvrir », gardé sur l'APPAREIL
 * (`tentacle_octave_startup` : `last` | `octave` | `tentacle`). Absent : le
 * défaut, `last` — un appareil d'avant ce réglage garde son comportement
 * (le mode allumé se rouvrait déjà). Clé de stockage : elle ne se renomme
 * jamais.
 */

import { useSyncExternalStore } from "react";
import { DEFAULT_OCTAVE_STARTUP, parseOctaveStartup, type OctaveStartupChoice } from "./octaveStartup";

export const OCTAVE_STARTUP_KEY = "tentacle_octave_startup";

const listeners = new Set<() => void>();

export function readOctaveStartup(): OctaveStartupChoice {
  try {
    return typeof localStorage === "undefined" ? DEFAULT_OCTAVE_STARTUP : parseOctaveStartup(localStorage.getItem(OCTAVE_STARTUP_KEY));
  } catch {
    return DEFAULT_OCTAVE_STARTUP;
  }
}

let current = readOctaveStartup();

export function getOctaveStartup(): OctaveStartupChoice {
  return current;
}

export function setOctaveStartup(choice: OctaveStartupChoice): void {
  if (choice === current) return;
  current = choice;
  try {
    // Le défaut ne s'écrit pas : la clé absente le vaut déjà.
    if (choice === DEFAULT_OCTAVE_STARTUP) localStorage.removeItem(OCTAVE_STARTUP_KEY);
    else localStorage.setItem(OCTAVE_STARTUP_KEY, choice);
  } catch {
    /* stockage refusé : le choix vaut jusqu'au prochain lancement */
  }
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useOctaveStartup(): OctaveStartupChoice {
  return useSyncExternalStore(subscribe, getOctaveStartup, () => DEFAULT_OCTAVE_STARTUP);
}
