/**
 * Octave (mobile) — l'horloge du BATTEMENT du fond : la position de lecture (s), qui avance sur le fil
 * d'interface entre deux nouvelles du moteur (quatre par seconde), et une intensité (`on`, 0..1) qui s'éteint en
 * douceur en pause, pendant une attente du réseau et dès que le fond ne doit plus bouger (`active` faux :
 * lecteur fermé, app derrière, mouvement réduit). Aucun rendu React : l'abonnement à la position n'existe que
 * tant que le fond bouge.
 */

import { useEffect } from "react";
import { cancelAnimation, Easing, useSharedValue, withSequence, withTiming, type SharedValue } from "react-native-reanimated";
import { useOctavePlayer } from "../OctavePlayerContext";
import { beatNeedsResync } from "./ambientBeat";

/** L'horloge court sur ce temps (s) puis se recale d'elle-même à la nouvelle suivante. */
const HORIZON_S = 600;
const FADE_MS = 400;

export interface BeatClock {
  time: SharedValue<number>;
  on: SharedValue<number>;
}

export function useBeatClock(active: boolean): BeatClock {
  const player = useOctavePlayer();
  const time = useSharedValue(0);
  const on = useSharedValue(0);
  useEffect(() => {
    let ticking = false;
    const stop = (seconds: number | null) => {
      if (ticking) cancelAnimation(time);
      ticking = false;
      if (seconds !== null) time.value = seconds;
      on.value = withTiming(0, { duration: FADE_MS });
    };
    if (!active) {
      stop(null);
      return;
    }
    const follow = () => {
      const position = player.position.get();
      const seconds = position.positionMs / 1000;
      if (!position.running) {
        stop(seconds);
        return;
      }
      if (ticking && !beatNeedsResync(time.value, seconds)) return;
      if (!ticking) on.value = withTiming(1, { duration: FADE_MS });
      ticking = true;
      time.value = withSequence(
        withTiming(seconds, { duration: 0 }),
        withTiming(seconds + HORIZON_S, { duration: HORIZON_S * 1000, easing: Easing.linear }),
      );
    };
    follow();
    const off = player.position.subscribe(follow);
    return () => {
      off();
      stop(null);
    };
  }, [active, player, time, on]);
  return { time, on };
}
