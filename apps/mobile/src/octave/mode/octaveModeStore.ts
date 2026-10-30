/**
 * Octave (mobile) — le MODE de l'application, comme sur le bureau : allumé,
 * l'app s'ouvre sur la musique au prochain lancement (selon « Au démarrage,
 * ouvrir ») ; éteint, Tentacle, intact. Préférence d'APPAREIL
 * (`tentacle_octave_mode`, même clé que le web et le bureau). Le mode de départ
 * est la décision du lancement (`octaveLaunch.ts`) ; `configureOctaveMode`
 * branche le stockage hydraté.
 */

import { useSyncExternalStore } from "react";
import type { StorageAdapter } from "@tentacle-tv/api-client";
import { OCTAVE_MODE_KEY, octavePaths } from "@tentacle-tv/shared/octave/mode";
import { markOctaveReached, octaveLaunch } from "../launch/octaveLaunch";

let storage: StorageAdapter | null = null;
let current = false;
const listeners = new Set<() => void>();

function persist(on: boolean): void {
  if (on) storage?.setItem(OCTAVE_MODE_KEY, "1");
  else storage?.removeItem(OCTAVE_MODE_KEY);
}

/** À l'hydratation du stockage (racine) : le mode de départ est celui du lancement, et il s'écrit tel quel. */
export function configureOctaveMode(adapter: StorageAdapter): void {
  storage = adapter;
  current = octaveLaunch().inOctave;
  if ((adapter.getItem(OCTAVE_MODE_KEY) === "1") !== current) persist(current);
  for (const listener of listeners) listener();
}

export function isOctaveMode(): boolean {
  return current;
}

export function setOctaveMode(on: boolean): void {
  // Quitter Octave tranche la redirection du lancement : Tentacle ne renvoie plus jamais dans la musique.
  if (!on) markOctaveReached();
  if (on === current) return;
  current = on;
  persist(on);
  for (const listener of listeners) listener();
}

export function subscribeOctaveMode(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useOctaveMode(): boolean {
  return useSyncExternalStore(subscribeOctaveMode, isOctaveMode, isOctaveMode);
}

/** Le stockage d'appareil branché (null avant l'hydratation). */
export function octaveStorage(): StorageAdapter | null {
  return storage;
}

/**
 * L'accueil du MODE en cours : celui d'Octave en mode musique, celui de Tentacle sinon. Une sortie forcée (retour
 * au compte de l'appareil hors ligne…) y mène — jamais l'accueil de Tentacle sous un mode Octave allumé.
 */
export function modeHomePath(): string {
  return current ? octavePaths.home : "/(tabs)";
}
