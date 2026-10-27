/**
 * Le réglage « Transition douce » d'Octave : une préférence de l'APPAREIL (`tentacle_octave_crossfade`, la
 * durée du fondu en ms, « 0 » = coupée ; absente : ALLUMÉE à 3 s, la règle partagée `readCrossfadeSetting`). Lue par le fournisseur du moteur, qui la passe
 * au port (`setCrossfade`), et par la ligne des Réglages d'Octave. Aucune capacité serveur : tout se joue ici.
 * ⚠️ Clé traversée par une chaîne : jamais renommée.
 */

import { useSyncExternalStore } from "react";
import { CROSSFADE_DEFAULT_MS, CROSSFADE_STORAGE_KEY, readCrossfadeSetting, sanitizeCrossfadeMs } from "./crossfadeRules";

export { CROSSFADE_STORAGE_KEY };

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function read(): number {
  try {
    return readCrossfadeSetting(storage()?.getItem(CROSSFADE_STORAGE_KEY) ?? null);
  } catch {
    return CROSSFADE_DEFAULT_MS;
  }
}

let crossfadeMs = read();
const listeners = new Set<() => void>();

export const getCrossfadeMs = (): number => crossfadeMs;

export function setCrossfadeMs(next: number): void {
  const value = sanitizeCrossfadeMs(next);
  if (value === crossfadeMs) return;
  crossfadeMs = value;
  try {
    storage()?.setItem(CROSSFADE_STORAGE_KEY, String(value));
  } catch {
    /* Persistance impossible : le choix vaut pour la session en cours. */
  }
  for (const listener of listeners) listener();
}

export function subscribeCrossfade(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useCrossfadeMs(): number {
  return useSyncExternalStore(subscribeCrossfade, getCrossfadeMs, getCrossfadeMs);
}
