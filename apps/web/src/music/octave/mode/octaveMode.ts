/**
 * Octave — le MODE de l'application, comme le mode hors ligne : allumé, l'app
 * s'ouvre sur l'interface musique (`/octave`) et y revient au prochain
 * lancement ; éteint, l'interface d'avant, intacte.
 *
 * Préférence d'APPAREIL (une fenêtre, un navigateur) : `tentacle_octave_mode`
 * — le mode où l'on est, gardé quand on quitte ; le lancement suit le réglage
 * « Au démarrage, ouvrir » (`octaveStartup.ts`).
 * Clé de stockage : elle ne se renomme jamais.
 */

import { useSyncExternalStore } from "react";
import { startupWantsOctave } from "./octaveStartup";
import { readOctaveStartup } from "./octaveStartupStore";
import { OCTAVE_MODE_KEY } from "@tentacle-tv/shared/octave/mode";

export { OCTAVE_MODE_KEY, OCTAVE_BASE_PATH } from "@tentacle-tv/shared/octave/mode";

const listeners = new Set<() => void>();

function read(): boolean {
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem(OCTAVE_MODE_KEY) === "1";
  } catch {
    return false;
  }
}

function persist(on: boolean): void {
  try {
    if (on) localStorage.setItem(OCTAVE_MODE_KEY, "1");
    else localStorage.removeItem(OCTAVE_MODE_KEY);
  } catch {
    /* stockage refusé : le mode vaut pour cette session seulement */
  }
}

/**
 * Décidé UNE fois, au chargement du module (= au lancement de l'app, ou au
 * rechargement de la page) : le réglage « Au démarrage, ouvrir » appliqué au
 * dernier mode. Le résultat devient le mode courant, donc le « dernier mode »
 * du prochain lancement.
 */
function launchMode(): boolean {
  const last = read();
  const wanted = startupWantsOctave(readOctaveStartup(), last);
  if (wanted !== last) persist(wanted);
  return wanted;
}

let current = launchMode();

export function isOctaveMode(): boolean {
  return current;
}

export function setOctaveMode(on: boolean): void {
  if (on === current) return;
  current = on;
  persist(on);
  for (const l of listeners) l();
}

export function subscribeOctaveMode(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useOctaveMode(): boolean {
  return useSyncExternalStore(subscribeOctaveMode, isOctaveMode, () => false);
}
