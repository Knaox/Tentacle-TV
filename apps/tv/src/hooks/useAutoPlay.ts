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

interface AutoPlayState {
  countdown: number | null;
  nextEpisode: MediaItem | null;
  nextEpisodeTitle: string | undefined;
  nextEpisodeImageUrl: string | undefined;
  nextEpisodeDescription: string | undefined;
  startAutoPlay: () => void;
  cancelAutoPlay: () => void;
  navigateToNextEpisode: () => void;
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
  const autoPlayTimerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const creditsTriggered = useRef(false);
  const countdownRef = useRef<number | null>(null);

  // Keep countdown ref in sync for checkTrigger
  countdownRef.current = countdown;

  // Reset state when item changes
  useEffect(() => {
    creditsTriggered.current = false;
    setCountdown(null);
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
    const ep = nextEpisodeRef.current;
    if (ep) {

      onNavigateRef.current(ep.Id);
    }
  }, []);

  const startAutoPlay = useCallback(() => {
    const ep = nextEpisodeRef.current;
    if (!ep) return;

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
    // Keep creditsTriggered=true so the overlay doesn't re-appear
  }, []);

  const startAutoPlayRef = useRef(startAutoPlay);
  startAutoPlayRef.current = startAutoPlay;

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
      startAutoPlayRef.current();
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

  return {
    countdown,
    nextEpisode,
    nextEpisodeTitle,
    nextEpisodeImageUrl,
    nextEpisodeDescription,
    startAutoPlay,
    cancelAutoPlay,
    navigateToNextEpisode,
    checkTrigger,
  };
}
