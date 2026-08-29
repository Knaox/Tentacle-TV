/**
 * Les deux ordres qu'on donne directement à l'élément `<video>` : lire/mettre
 * en pause, et changer la vitesse.
 *
 * `applyRate` pose `defaultPlaybackRate` EN PLUS de `playbackRate`, et ce n'est
 * pas une redondance : la spécification remet `playbackRate` à
 * `defaultPlaybackRate` au chargement de chaque nouvelle ressource. Sans lui,
 * la vitesse choisie était perdue à la moindre reconstruction de source —
 * changement de qualité, repli CORS, seek qui relance le transcodage.
 *
 * Extrait de `VideoPlayer.tsx` pour le ramener sous les 300 lignes.
 */

import { useCallback, type RefObject } from "react";

export interface VideoCommands {
  togglePlay: () => void;
  applyRate: (rate: number) => void;
}

export function useVideoCommands(videoRef: RefObject<HTMLVideoElement | null>): VideoCommands {
  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {}); else v.pause();
  }, [videoRef]);

  const applyRate = useCallback((rate: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.playbackRate = rate;
    v.defaultPlaybackRate = rate;
  }, [videoRef]);

  return { togglePlay, applyRate };
}
