import { useState, useRef, useCallback, useEffect } from "react";
import { useEpisodeNavigation, useJellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";

const COUNTDOWN_TOTAL = 10;
const FALLBACK_SECONDS = 30;
const MIN_DURATION_FOR_FALLBACK = 120;

interface SkipSegment {
  start: number;
  end: number;
}

export type AutoPlaySource = "credits" | "eof";

interface AutoPlayState {
  countdown: number | null;
  /** "credits" = bannière pendant le générique ; "eof" = écran plein à la vraie
   *  fin (parité desktop DesktopPlayer credits/eof). */
  source: AutoPlaySource | null;
  nextEpisode: MediaItem | null;
  nextEpisodeTitle: string | undefined;
  nextEpisodeImageUrl: string | undefined;
  nextEpisodeDescription: string | undefined;
  /** Overview complet (l'écran plein clampe à 3 lignes au rendu). */
  nextEpisodeOverview: string | undefined;
  /** Backdrop de la SÉRIE (fond plein écran de l'écran de fin). */
  seriesBackdropUrl: string | undefined;
  /** Primary de l'épisode suivant (vignette de l'écran de fin). */
  nextEpisodeThumbUrl: string | undefined;
  startAutoPlay: (src?: AutoPlaySource) => void;
  cancelAutoPlay: () => void;
  navigateToNextEpisode: () => void;
  /** À la VRAIE fin du média : escalade la bannière en écran plein (countdown
   *  conservé) ou lance un countdown "eof". Idempotent (onEnd répétés OK). */
  notifyEnd: () => void;
  /** Call from handleProgress on every tick — checks if trigger point reached */
  checkTrigger: (currentTime: number) => void;
}

export function useAutoPlay(
  item: MediaItem | undefined,
  duration: number,
  creditsSegment: SkipSegment | null | undefined,
  onNavigateToEpisode: (episodeId: string) => void,
): AutoPlayState {
  const client = useJellyfinClient();
  const { nextEpisode } = useEpisodeNavigation(item);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [source, setSource] = useState<AutoPlaySource | null>(null);
  const autoPlayTimerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const creditsTriggered = useRef(false);
  // Affiche de FIN écartée (dismiss) : ne plus la représenter (parité desktop).
  const eofTriggeredRef = useRef(false);
  const countdownRef = useRef<number | null>(null);

  // Keep countdown ref in sync for checkTrigger
  countdownRef.current = countdown;

  // Reset state when item changes
  useEffect(() => {
    creditsTriggered.current = false;
    eofTriggeredRef.current = false;
    setCountdown(null);
    setSource(null);
    clearInterval(autoPlayTimerRef.current);
  }, [item?.Id]);

  // Stable refs
  const onNavigateRef = useRef(onNavigateToEpisode);
  onNavigateRef.current = onNavigateToEpisode;
  const nextEpisodeRef = useRef(nextEpisode);
  nextEpisodeRef.current = nextEpisode;
  const durationRef = useRef(duration);
  durationRef.current = duration;
  const creditsSegmentRef = useRef(creditsSegment);
  creditsSegmentRef.current = creditsSegment;

  const navigateToNextEpisode = useCallback(() => {
    clearInterval(autoPlayTimerRef.current);
    setCountdown(null);
    setSource(null);
    const ep = nextEpisodeRef.current;
    if (ep) {
      onNavigateRef.current(ep.Id);
    }
  }, []);

  const startAutoPlay = useCallback((src: AutoPlaySource = "credits") => {
    const ep = nextEpisodeRef.current;
    if (!ep) return;

    setSource(src);
    setCountdown(COUNTDOWN_TOTAL);
    clearInterval(autoPlayTimerRef.current);
    autoPlayTimerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(autoPlayTimerRef.current);
          navigateToNextEpisode();
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  }, [navigateToNextEpisode]);

  const cancelAutoPlay = useCallback(() => {
    clearInterval(autoPlayTimerRef.current);
    setCountdown(null);
    // Écarter l'affiche de FIN empêche sa réapparition (notifyEnd re-déclenché
    // par des onEnd répétés). La bannière crédits a sa propre garde
    // (creditsTriggered reste vrai).
    setSource((s) => {
      if (s === "eof") eofTriggeredRef.current = true;
      return null;
    });
  }, []);

  const startAutoPlayRef = useRef(startAutoPlay);
  startAutoPlayRef.current = startAutoPlay;

  /** Vraie fin du média (onEnd) : écran plein « épisode suivant ». */
  const notifyEnd = useCallback(() => {
    if (!nextEpisodeRef.current) return;
    if (eofTriggeredRef.current) return;      // écarté → pas de réapparition
    if (countdownRef.current !== null) {
      // Bannière crédits déjà ouverte → ESCALADE en plein écran, countdown conservé.
      setSource("eof");
      return;
    }
    startAutoPlayRef.current("eof");
  }, []);

  /**
   * Called directly from handleProgress on every progress tick.
   * NOT dependent on React re-renders — fires on every native callback.
   */
  const checkTrigger = useCallback((currentTime: number) => {
    if (creditsTriggered.current || countdownRef.current !== null) return;
    const ep = nextEpisodeRef.current;
    const dur = durationRef.current;
    if (!ep || dur <= 0) return;

    const cs = creditsSegmentRef.current;
    const triggerAt = cs
      ? cs.start
      : (FALLBACK_SECONDS > 0 && dur > MIN_DURATION_FOR_FALLBACK
        ? dur - FALLBACK_SECONDS
        : null);

    if (triggerAt != null && currentTime >= triggerAt) {
      creditsTriggered.current = true;
      startAutoPlayRef.current("credits");
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => () => clearInterval(autoPlayTimerRef.current), []);

  const nextEpisodeTitle = nextEpisode
    ? `S${nextEpisode.ParentIndexNumber}E${nextEpisode.IndexNumber} — ${nextEpisode.Name}`
    : undefined;

  const nextEpisodeImageUrl = nextEpisode?.Id
    ? client.getImageUrl(nextEpisode.Id, "Primary", { height: 200, quality: 85 })
    : undefined;

  const nextEpisodeDescription = nextEpisode?.Overview
    ? (nextEpisode.Overview.length > 120
      ? nextEpisode.Overview.slice(0, 120) + "..."
      : nextEpisode.Overview)
    : undefined;

  // Images de l'écran de fin plein écran (parité WatchDesktop) : backdrop de la
  // SÉRIE en fond + Primary de l'épisode suivant en vignette.
  const seriesBackdropUrl = nextEpisode
    ? client.getImageUrl(
      nextEpisode.SeriesId ?? nextEpisode.ParentBackdropItemId ?? nextEpisode.Id,
      "Backdrop",
      { width: 1920, quality: 85 },
    )
    : undefined;
  const nextEpisodeThumbUrl = nextEpisode?.Id
    ? client.getImageUrl(nextEpisode.Id, "Primary", { width: 500, quality: 90 })
    : undefined;

  return {
    countdown,
    source,
    nextEpisode,
    nextEpisodeTitle,
    nextEpisodeImageUrl,
    nextEpisodeDescription,
    nextEpisodeOverview: nextEpisode?.Overview ?? undefined,
    seriesBackdropUrl,
    nextEpisodeThumbUrl,
    startAutoPlay,
    cancelAutoPlay,
    navigateToNextEpisode,
    notifyEnd,
    checkTrigger,
  };
}
