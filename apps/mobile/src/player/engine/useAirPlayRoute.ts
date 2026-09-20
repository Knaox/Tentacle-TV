import { useCallback, useEffect, useRef } from "react";
import type { RefObject } from "react";
import { Platform } from "react-native";
import { isAirPlayRouteActive } from "../../../modules/mpv-player";
import type { PlayerEngineHandle } from "./types";

/**
 * Relit la route audio chaque seconde tant que `watching` : quand AirPlay
 * s'éteint sans que l'AVPlayer l'ait annoncé (ordre des notifications, app
 * restée en fond), `onRouteChange(false)` part quand même. La vue du lecteur
 * avancé, qui observait la route, est démontée pendant qu'AirPlay diffuse :
 * personne d'autre ne regarde. iOS seulement.
 */
export function useAirPlayRouteWatch(watching: boolean, onRouteChange: (active: boolean) => void): void {
  const callbackRef = useRef(onRouteChange);
  callbackRef.current = onRouteChange;
  useEffect(() => {
    if (Platform.OS !== "ios" || !watching) return;
    const timer = setInterval(() => {
      if (!isAirPlayRouteActive()) callbackRef.current(false);
    }, 1000);
    return () => clearInterval(timer);
  }, [watching]);
}

interface RestoreSeekOptions {
  engineRef: RefObject<PlayerEngineHandle | null>;
  positionRef: { current: number };
  /** Début du flux servi, en secondes absolues (transcodage) ; 0 en lecture directe. */
  streamOffset: number;
  videoReady: boolean;
}

/**
 * AirPlay qui s'allume pendant une lecture par le lecteur système : l'AVPlayer
 * recharge son flux depuis le début — on le ramène où on en était, en position
 * DANS le flux (un transcodage commence à `streamOffset`, pas à zéro). Sur un
 * vrai front montant seulement : l'AVPlayer annonce aussi `false` puis `true` à
 * chaque remplacement d'item, et une surface montée à l'instant est déjà à la
 * bonne place (position dans le flux inférieure à une seconde).
 */
export function useAirPlayRestoreSeek({ engineRef, positionRef, streamOffset, videoReady }: RestoreSeekOptions): (active: boolean) => void {
  const previousRef = useRef(false);
  const latest = useRef({ streamOffset, videoReady });
  latest.current = { streamOffset, videoReady };
  return useCallback((active: boolean) => {
    const rising = active && !previousRef.current;
    previousRef.current = active;
    if (!rising || !latest.current.videoReady) return;
    const inStream = positionRef.current - latest.current.streamOffset;
    if (inStream <= 1) return;
    setTimeout(() => engineRef.current?.seek(inStream), 500);
  }, [engineRef, positionRef]);
}
