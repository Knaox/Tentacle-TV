import { useCallback } from "react";
import type { MPVPlayerHandle } from "../components/player/MPVPlayer";

/** Une source qui se (re)charge met plus d'une seconde et demie à rejoindre la
 *  cible : la fenêtre de convergence d'un rechargement. */
const RELOAD_SEEK_WINDOW_MS = 8000;

/**
 * Seek client (timeline absolue dans tous les modes — direct play ET HLS
 * transcodé) : clamp sur la durée, mise à jour optimiste de l'affichage,
 * report serveur et armement de la fenêtre post-seek.
 *
 * Pendant un (re)chargement de la source (relance du flux, piste, qualité),
 * la recherche vise la source QUI ARRIVE : elle devient la cible de la
 * réouverture en vol (`noteSeek`), et la fenêtre de convergence attend que la
 * nouvelle source l'ait rejointe — comme un rechargement, pas 1,5 s.
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
  /** La source se (re)charge : indicateur posé par un rechargement ou une attente de données. */
  loadingRef?: React.MutableRefObject<boolean>;
  /** La relance du flux en vol prend la recherche pour cible (`useStreamRestart`). */
  noteSeek?: (target: number) => void;
}) {
  const {
    jellyfinDuration, playerRef, paused,
    displayTimeRef, positionRef, lastDisplayUpdate, lastProgressTime,
    reportSeek, setDisplayTime, notifySeekRef, controlsCurrentTimeRef, loadingRef, noteSeek,
  } = args;

  const handleSeek = useCallback((seconds: number) => {
    const dur = jellyfinDuration || 0;
    const clamped = Math.max(0, dur > 0 ? Math.min(seconds, dur) : seconds);
    noteSeek?.(clamped);
    if (loadingRef?.current) notifySeekRef.current(clamped, RELOAD_SEEK_WINDOW_MS, true);
    else notifySeekRef.current(clamped);
    displayTimeRef.current = clamped;
    positionRef.current = clamped;
    if (controlsCurrentTimeRef) controlsCurrentTimeRef.current = clamped;
    setDisplayTime(clamped);
    lastDisplayUpdate.current = Date.now();
    lastProgressTime.current = Date.now();
    // Timeline absolue dans tous les modes (cf. note reprise plus haut). La
    // surface retient une recherche faite avant que sa source soit prête.
    playerRef.current?.seek(clamped);
    reportSeek(clamped, paused);
    // Plus rien à réévaluer à la main : la position est une ENTRÉE de l'arbitre,
    // qui recalcule ce qu'il propose à chaque changement.
  }, [jellyfinDuration, paused, reportSeek, playerRef, noteSeek]); // eslint-disable-line react-hooks/exhaustive-deps

  return { handleSeek };
}
