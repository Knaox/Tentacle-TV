import { useState, useEffect, useRef, useCallback } from "react";
import type { SegmentTimestamps, MediaItem } from "@tentacle-tv/shared";

const AUTOPLAY_COUNTDOWN_SEC = 10;
/** Fenêtre (s) avant la fin pour afficher l'autoplay si pas de segment crédits. */
const AUTOPLAY_END_FALLBACK_SEC = 120;
/** Pas d'autoplay fallback sur les clips courts (< 5 min). */
const MIN_DURATION_FOR_FALLBACK_SEC = 300;

export const AUTOPLAY_TOTAL_SEC = AUTOPLAY_COUNTDOWN_SEC;

interface Params {
  currentTime: number;
  duration: number;
  creditsSegment?: SegmentTimestamps | null;
  nextEpisode?: MediaItem | null;
  onNextEpisode?: () => void;
}

/**
 * Compte à rebours « Épisode suivant » — déclenché au segment crédits (ou
 * `duration - 120s` à défaut). Navigation déclenchée hors render. Extrait de
 * MobilePlayerOverlay pour garder ce dernier sous 300 lignes.
 */
export function useAutoPlayNext({ currentTime, duration, creditsSegment, nextEpisode, onNextEpisode }: Params) {
  const [showAutoPlay, setShowAutoPlay] = useState(false);
  const [countdown, setCountdown] = useState(AUTOPLAY_COUNTDOWN_SEC);
  const dismissed = useRef(false);
  const triggered = useRef(false);
  const navigated = useRef(false);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const start = useCallback(() => {
    if (!nextEpisode || !onNextEpisode || triggered.current) return;
    triggered.current = true;
    setCountdown(AUTOPLAY_COUNTDOWN_SEC);
    setShowAutoPlay(true);
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => setCountdown((p) => Math.max(0, p - 1)), 1000);
  }, [nextEpisode, onNextEpisode]);

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  // Countdown à zéro → navigation hors render.
  useEffect(() => {
    if (!triggered.current || navigated.current || countdown !== 0) return;
    navigated.current = true;
    if (timer.current) clearInterval(timer.current);
    onNextEpisode?.();
  }, [countdown, onNextEpisode]);

  // Déclenchement (même condition que desktop).
  useEffect(() => {
    if (triggered.current || dismissed.current || !nextEpisode || !onNextEpisode) return;
    const triggerAt = creditsSegment
      ? creditsSegment.start
      : (duration > MIN_DURATION_FOR_FALLBACK_SEC ? duration - AUTOPLAY_END_FALLBACK_SEC : null);
    if (triggerAt != null && currentTime >= triggerAt) start();
  }, [currentTime, creditsSegment, nextEpisode, onNextEpisode, duration, start]);

  const dismiss = useCallback(() => {
    dismissed.current = true;
    if (timer.current) clearInterval(timer.current);
    setShowAutoPlay(false);
  }, []);

  return { showAutoPlay, countdown, dismiss };
}
