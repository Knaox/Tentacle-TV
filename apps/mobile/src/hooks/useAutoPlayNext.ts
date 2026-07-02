import { useState, useEffect, useRef, useCallback } from "react";
import { useAutoplayConfig } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";

const AUTOPLAY_COUNTDOWN_SEC = 10;

export const AUTOPLAY_TOTAL_SEC = AUTOPLAY_COUNTDOWN_SEC;

interface Params {
  currentTime: number;
  duration: number;
  nextEpisode?: MediaItem | null;
  onNextEpisode?: () => void;
}

/**
 * Compte à rebours « Épisode suivant » — déclenché au MaxResumePct de Jellyfin
 * (ex. 92 % → à 92 % de lecture ; config pollée pendant la lecture, gating par
 * l'interrupteur admin « Déclenchement auto-play »). Navigation déclenchée
 * hors render. Extrait de MobilePlayerOverlay pour garder ce dernier sous
 * 300 lignes.
 */
export function useAutoPlayNext({ currentTime, duration, nextEpisode, onNextEpisode }: Params) {
  const { data: autoplayConfig } = useAutoplayConfig(true);
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

  // Déclenchement (même condition que desktop) : au % MaxResumePct, relu à
  // chaque tick → une mise à jour dans Jellyfin s'applique en cours de lecture.
  const enabled = autoplayConfig?.enabled ?? true;
  const maxResumePct = autoplayConfig?.maxResumePct ?? 90;
  useEffect(() => {
    if (triggered.current || dismissed.current || !enabled || !nextEpisode || !onNextEpisode) return;
    const triggerAt = duration > 0 ? duration * (maxResumePct / 100) : null;
    if (triggerAt != null && currentTime >= triggerAt) start();
  }, [currentTime, enabled, maxResumePct, nextEpisode, onNextEpisode, duration, start]);

  const dismiss = useCallback(() => {
    dismissed.current = true;
    if (timer.current) clearInterval(timer.current);
    setShowAutoPlay(false);
  }, []);

  return { showAutoPlay, countdown, dismiss };
}
