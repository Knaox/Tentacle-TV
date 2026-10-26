/**
 * Le réglage « Transition douce » d'Octave : une préférence de l'APPAREIL (`tentacle_octave_crossfade`, la
 * durée du fondu en ms, 0 = coupée — le défaut, comme Spotify). Lue par le fournisseur du moteur, qui la passe
 * au port (`setCrossfade`), et par la ligne des Réglages d'Octave. Aucune capacité serveur : tout se joue ici.
 * ⚠️ Clé traversée par une chaîne : jamais renommée.
 */

import { useSyncExternalStore } from "react";
import { sanitizeCrossfadeMs } from "./crossfadeRules";

export const CROSSFADE_STORAGE_KEY = "tentacle_octave_crossfade";

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function read(): number {
  try {
    return sanitizeCrossfadeMs(storage()?.getItem(CROSSFADE_STORAGE_KEY) ?? 0);
  } catch {
    return 0;
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
