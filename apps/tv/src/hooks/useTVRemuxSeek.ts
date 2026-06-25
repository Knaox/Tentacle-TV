import { useCallback } from "react";
import { TICKS_PER_SECOND } from "@tentacle-tv/shared";

/**
 * Routage du SEEK sur le lecteur REMUX local tvOS (« façon Infuse »).
 *  - Cible DANS la fenêtre disponible (segments présents sur disque, ≈ [tête−1min … tête+5min]) →
 *    seek NATIF AVPlayer (instantané).
 *  - Cible HORS fenêtre (gros saut devant le tampon produit, OU retour arrière dans la zone purgée
 *    par TVWindow.m) → RE-REMUX d'une nouvelle session depuis la cible : on pose `startTicks` (→
 *    `startSeconds` → `useTVStreamUrl.ios` relance `__remux.start` qui fait `av_seek_frame` sur
 *    l'entrée → démarrage rapide à T au lieu de relire depuis 0, et plus de 404 stall sur un retour
 *    arrière purgé). Le natif arbitre (`withinAvail`) si la cible est en fait déjà disponible.
 *
 * Android / direct play natif : `isLocalRemuxRef=false` → seek natif direct (comportement INCHANGÉ,
 * la décision remux est isolée ici, pas dans le cerveau partagé `useTVPlayerControls`).
 */
export function useTVRemuxSeek(args: {
  jellyfinDuration?: number;
  /** Seek natif (useTVSeekControl) : utilisé quand la cible est dans la fenêtre disponible. */
  handleSeek: (seconds: number) => void;
  isLocalRemuxRef: React.MutableRefObject<boolean>;
  positionRef: React.MutableRefObject<number>;
  displayTimeRef: React.MutableRefObject<number>;
  lastDisplayUpdate: React.MutableRefObject<number>;
  lastProgressTime: React.MutableRefObject<number>;
  pausedStateRef: React.MutableRefObject<boolean>;
  softReloadRef: React.MutableRefObject<boolean>;
  setReloadFrameSec: (v: number | null) => void;
  setDisplayTime: (v: number) => void;
  notifySeekRef: React.MutableRefObject<(target: number, windowMs?: number, afterReload?: boolean) => void>;
  reportSeek: (seconds: number, paused: boolean) => void;
  setStartTicks: (v: number) => void;
  setReloadNonce: React.Dispatch<React.SetStateAction<number>>;
}): (seconds: number) => void {
  const {
    jellyfinDuration, handleSeek, isLocalRemuxRef, positionRef, displayTimeRef,
    lastDisplayUpdate, lastProgressTime, pausedStateRef, softReloadRef, setReloadFrameSec,
    setDisplayTime, notifySeekRef, reportSeek, setStartTicks, setReloadNonce,
  } = args;

  return useCallback((seconds: number) => {
    const dur = jellyfinDuration || 0;
    const clamped = Math.max(0, dur > 0 ? Math.min(seconds, dur) : seconds);
    if (isLocalRemuxRef.current) {
      const pos = positionRef.current;
      // Fenêtre conservée par le natif : ~60s derrière (TVLR_BEHIND_SEC), ~300s devant (pacing).
      if (clamped < pos - 55 || clamped > pos + 295) {
        softReloadRef.current = true;
        setReloadFrameSec(pos);                       // dernière image figée pendant le re-remux
        displayTimeRef.current = clamped; positionRef.current = clamped;
        setDisplayTime(clamped);
        lastDisplayUpdate.current = Date.now(); lastProgressTime.current = Date.now();
        notifySeekRef.current(clamped, 8000, true);   // fenêtre post-reload → atterrissage propre à la cible
        reportSeek(clamped, pausedStateRef.current);
        setStartTicks(Math.floor(clamped) * TICKS_PER_SECOND);  // nouvelle session re-remux depuis la cible
        setReloadNonce((n) => n + 1);
        return;
      }
    }
    handleSeek(clamped);   // dans la fenêtre → seek natif AVPlayer (instantané)
  }, [jellyfinDuration, handleSeek, reportSeek]); // eslint-disable-line react-hooks/exhaustive-deps
}
