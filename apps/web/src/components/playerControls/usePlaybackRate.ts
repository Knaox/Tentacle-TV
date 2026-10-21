import { useCallback, useEffect, useRef, useState } from "react";
import { NORMAL_RATE } from "@tentacle-tv/shared";
import { useWatchTogether } from "../../watchTogether/WatchTogetherProvider";

export interface PlaybackRateState {
  rate: number;
  /** Pose le taux et l'applique au moteur. */
  choose: (value: number) => void;
}

/**
 * Le taux de lecture et sa remise à 1× — au changement de média et à l'entrée
 * en groupe. Indispensable côté mpv : sa propriété `speed` SURVIT au loadfile,
 * un épisode lancé à 2× repartirait à 2× sans que rien ne l'affiche.
 *
 * Tenu par `PlaybackRateControl` lui-même (lecteur web), ou plus haut quand le
 * bouton peut se REMONTER sans que la lecture change : le lecteur de bureau
 * change d'habillage (verre ↔ celui d'avant) si l'on coupe le réglage en
 * pleine lecture, et un état tenu par le bouton remettait mpv à 1×.
 *
 * `enabled` faux : rien ne se remet ni ne s'applique (l'état vit ailleurs).
 */
export function usePlaybackRate(apply: (rate: number) => void, resetKey?: string, enabled = true): PlaybackRateState {
  const { isInGroup } = useWatchTogether();
  const [rate, setRate] = useState<number>(NORMAL_RATE);
  // `apply` est recréée à chaque rendu du parent : la garder en ref évite
  // de relancer la remise à 1× à chaque tour.
  const applyRef = useRef(apply);
  applyRef.current = apply;

  useEffect(() => {
    if (!enabled) return;
    setRate(NORMAL_RATE);
    applyRef.current(NORMAL_RATE);
  }, [resetKey, isInGroup, enabled]);

  const choose = useCallback((value: number) => {
    setRate(value);
    applyRef.current(value);
  }, []);

  return { rate, choose };
}
