/**
 * Octave (mobile) — ce qu'Octave RETIENT de Tentacle, comme sur le bureau
 * (`octaveLaunchStore.ts` du web) :
 * - en mode Octave, et au lancement en Octave jusqu'à la première sortie, les
 *   recouvrements de démarrage de Tentacle (règle : `tentacleOverlays.ts`) ;
 * - au lancement en Octave, la relecture du cache des films, jusqu'à la
 *   première sortie (ou le repos).
 */

import { useSyncExternalStore } from "react";
import { isOctaveMode, subscribeOctaveMode } from "../mode/octaveModeStore";
import { octaveLaunch, octaveLaunchDecision } from "./octaveLaunch";
import { tentacleHeldNow } from "./tentacleOverlays";

let released = false;
/** Attendent la première sortie d'Octave (lancement en Octave). */
const releaseListeners = new Set<() => void>();

subscribeOctaveMode(() => {
  if (isOctaveMode() || released) return;
  released = true;
  for (const listener of releaseListeners) listener();
});

/** Tentacle est-il retenu (mode Octave, ou lancement en Octave jamais quitté) ? */
export function isTentacleHeld(): boolean {
  return tentacleHeldNow({ octaveMode: isOctaveMode(), launchedInOctave: octaveLaunch().inOctave, released });
}

/** Suit le mode Octave (entrée, sortie) : `isTentacleHeld` en dépend. */
export function useTentacleHeld(): boolean {
  return useSyncExternalStore(subscribeOctaveMode, isTentacleHeld, isTentacleHeld);
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
      releaseListeners.delete(go);
      clearTimeout(timer);
      run();
    };
    releaseListeners.add(go);
    const timer = setTimeout(go, TENTACLE_IDLE_DELAY_MS);
  });
}
