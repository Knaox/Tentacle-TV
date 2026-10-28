/**
 * Octave (mobile) — ce qu'un lancement en Octave RETIENT de Tentacle, comme sur
 * le bureau (`octaveLaunchStore.ts` du web) : tant qu'on n'a pas quitté Octave,
 * ni les recouvrements de démarrage de Tentacle (affiche de la Famille,
 * invitation aux avatars, conseil du code PIN), ni la relecture du cache des
 * films. Quitter Octave relâche tout, une fois pour la session.
 */

import { useSyncExternalStore } from "react";
import { isOctaveMode, subscribeOctaveMode } from "../mode/octaveModeStore";
import { octaveLaunch, octaveLaunchDecision } from "./octaveLaunch";

let released = false;
const listeners = new Set<() => void>();

function release(): void {
  if (released) return;
  released = true;
  for (const listener of listeners) listener();
}

subscribeOctaveMode(() => {
  if (!isOctaveMode()) release();
});

/** Tentacle est-il encore retenu (lancement en Octave, jamais quitté depuis) ? */
export function isTentacleHeld(): boolean {
  return !released && octaveLaunch().inOctave;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useTentacleHeld(): boolean {
  return useSyncExternalStore(subscribe, isTentacleHeld, isTentacleHeld);
}

/** Après la première image d'Octave, le temps au repos avant le travail de Tentacle retenu. */
const TENTACLE_IDLE_DELAY_MS = 2_500;

/**
 * Le travail de démarrage de TENTACLE qui n'a rien à faire dans Octave : tout
 * de suite hors d'un lancement en Octave ; sinon au repos, ou dès qu'on quitte
 * Octave — une fois.
 */
export function whenTentacleNeeded(run: () => void): void {
  void octaveLaunchDecision().then((launch) => {
    if (!launch.inOctave) {
      run();
      return;
    }
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      listeners.delete(go);
      clearTimeout(timer);
      run();
    };
    listeners.add(go);
    const timer = setTimeout(go, TENTACLE_IDLE_DELAY_MS);
  });
}
