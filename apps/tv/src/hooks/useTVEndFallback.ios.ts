import { useEffect, useRef } from "react";
import type { TVEndFallbackArgs } from "./useTVEndFallback";

export type { TVEndFallbackArgs } from "./useTVEndFallback";

/** Position considérée figée si elle bouge de moins que ça entre deux ticks. */
const STAGNATION_EPS_SEC = 0.25;
/** Durée de stagnation avant de conclure à la fin (si près de la fin réelle). */
const STAGNATION_MS = 2500;
/** Marge « près de la fin » (métadonnées Jellyfin OU fin d'écrit du remux terminé). */
const NEAR_END_SEC = 3;

/**
 * Filet de détection de FIN — variante **tvOS**, remux local uniquement.
 *
 * La fin « officielle » est l'onEnd d'AVPlayer, qui exige que la playlist EVENT soit
 * terminée par ENDLIST **et** qu'AVPlayer daigne finaliser sa durée — bug connu :
 * elle reste parfois indéfinie après ENDLIST → onEnd ne vient JAMAIS. Symptôme : le
 * film se fige sur la dernière frame, le watchdog latch le spinner, et la stall-recovery
 * re-remuxe en boucle → « ça tourne en rond au générique ».
 *
 * Détail vicieux : à la fin bloquée, AVPlayer CONTINUE d'émettre des onProgress à
 * position CONSTANTE → un détecteur « plus de ticks » ne suffirait pas. On détecte donc
 * la STAGNATION de la position : inchangée (±0,25 s) depuis ≥ 2,5 s, hors pause/reload,
 * ET près de la fin réelle — métadonnées (RunTimeTicks) OU fin d'écrit d'un remux
 * TERMINÉ (info.done, robuste aux métadonnées fausses dans les deux sens) → handleEnd.
 */
export function useTVEndFallback(args: TVEndFallbackArgs): void {
  const {
    isLocalRemux, paused, jellyfinDuration, positionRef, infoRef,
    reloadHoldRef, softReloadRef, endedRef, onEndRef,
  } = args;
  const durRef = useRef(jellyfinDuration ?? 0);
  durRef.current = jellyfinDuration ?? 0;
  const lastRef = useRef<{ pos: number; at: number }>({ pos: -1, at: 0 });

  useEffect(() => {
    if (!isLocalRemux || paused) return;
    lastRef.current = { pos: -1, at: 0 };
    const id = setInterval(() => {
      if (endedRef.current || reloadHoldRef.current || softReloadRef.current) {
        lastRef.current = { pos: -1, at: 0 };
        return;
      }
      const pos = positionRef.current;
      const now = Date.now();
      const last = lastRef.current;
      if (last.pos < 0 || Math.abs(pos - last.pos) > STAGNATION_EPS_SEC) {
        lastRef.current = { pos, at: now };   // la lecture avance → réarmer
        return;
      }
      if (now - last.at < STAGNATION_MS) return;
      const dur = durRef.current;
      const info = infoRef.current;
      const nearMeta = dur > 0 && pos >= dur - NEAR_END_SEC;
      const nearWritten = !!info && info.done && !info.error
        && pos >= info.sessionStartSec + info.writtenSec - NEAR_END_SEC;
      if (nearMeta || nearWritten) {
        endedRef.current = true;   // handleEnd le re-pose (idempotent)
        onEndRef.current();
      }
      // Stagnation LOIN de la fin = vrai stall → laissé au watchdog/stall-recovery.
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLocalRemux, paused]);
}
