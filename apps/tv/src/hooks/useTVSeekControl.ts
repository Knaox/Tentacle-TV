import { useCallback } from "react";
import type { MPVPlayerHandle } from "../components/player/MPVPlayer";

/**
 * Seek client (timeline absolue dans tous les modes — direct play ET HLS
 * transcodé) : clamp sur la durée, mise à jour optimiste de l'affichage,
 * report serveur et armement de la fenêtre post-seek.
 */
export function useTVSeekControl(args: {
  jellyfinDuration?: number;
  playerRef: React.RefObject<MPVPlayerHandle | null>;
  paused: boolean;
  displayTimeRef: React.MutableRefObject<number>;
  positionRef: React.MutableRefObject<number>;
  lastDisplayUpdate: React.MutableRefObject<number>;
  lastProgressTime: React.MutableRefObject<number>;
  reportSeek: (seconds: number, paused: boolean) => void;
  setDisplayTime: (v: number) => void;
  notifySeekRef: React.MutableRefObject<(target: number, windowMs?: number, afterReload?: boolean) => void>;
  /** Base des skips ±10/30 (useTVPlayerControls) : synchronisée à chaque commit de seek —
   *  sinon un +30 juste après un seek repartait de l'ancienne position (progress pas encore accepté). */
  controlsCurrentTimeRef?: React.MutableRefObject<number>;
}) {
  const {
    jellyfinDuration, playerRef, paused,
    displayTimeRef, positionRef, lastDisplayUpdate, lastProgressTime,
    reportSeek, setDisplayTime, notifySeekRef, controlsCurrentTimeRef,
  } = args;

  const handleSeek = useCallback((seconds: number) => {
    const dur = jellyfinDuration || 0;
    const clamped = Math.max(0, dur > 0 ? Math.min(seconds, dur) : seconds);
    notifySeekRef.current(clamped);
    displayTimeRef.current = clamped;
    positionRef.current = clamped;
    if (controlsCurrentTimeRef) controlsCurrentTimeRef.current = clamped;
    setDisplayTime(clamped);
    lastDisplayUpdate.current = Date.now();
    lastProgressTime.current = Date.now();
    // Timeline absolue dans tous les modes (cf. note reprise plus haut)
    playerRef.current?.seek(clamped);
    reportSeek(clamped, paused);
    // Plus rien à réévaluer à la main : la position est une ENTRÉE de l'arbitre,
    // qui recalcule ce qu'il propose à chaque changement.
  }, [jellyfinDuration, paused, reportSeek, playerRef]); // eslint-disable-line react-hooks/exhaustive-deps

  return { handleSeek };
}
