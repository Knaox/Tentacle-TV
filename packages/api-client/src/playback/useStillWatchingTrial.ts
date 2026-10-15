/**
 * « Essayer », à côté du réglage « Vous regardez encore ? » : armer UN essai
 * pour la prochaine lecture (`stillWatchingTrial.ts`, shared). Armer est un
 * geste, donc une présence : le compteur de la session repart de zéro, et la
 * question paraît bien vingt secondes après le début de la lecture — pas plus
 * tôt parce qu'une lecture venait de s'arrêter.
 */

import { useCallback, useSyncExternalStore } from "react";
import { armStillWatchingTrialNow, cancelStillWatchingTrial, stillWatchingTrialSource } from "./stillWatchingTrialStore";
import { resetStillWatchingSession } from "./useStillWatching";

export interface StillWatchingTrialState {
  /** Un essai attend la prochaine lecture. */
  armed: boolean;
  /** Armer l'essai (un seul : réarmer repart de zéro). */
  arm: () => void;
  /** Renoncer à l'essai. */
  cancel: () => void;
}

export function useStillWatchingTrial(): StillWatchingTrialState {
  const { subscribe, readArmed } = stillWatchingTrialSource;
  const armed = useSyncExternalStore(subscribe, readArmed, readArmed);
  const arm = useCallback(() => {
    resetStillWatchingSession();
    armStillWatchingTrialNow();
  }, []);
  return { armed, arm, cancel: cancelStillWatchingTrial };
}
