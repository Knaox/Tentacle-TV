import { useCallback, useEffect, useRef } from "react";
import { TICKS_PER_SECOND } from "@tentacle-tv/shared";
import type { MediaItem } from "@tentacle-tv/shared";
import type { MPVPlayerHandle } from "../components/player/MPVPlayer";

interface AutoPlayCtx {
  checkTrigger: (t: number) => void;
  nextEpisode: MediaItem | null;
  countdown: number | null;
  startAutoPlay: () => void;
}

/**
 * Regroupe les callbacks transmis aux players ExoPlayer/MPV :
 *  - handleLoad : seek au resume + reportStart
 *  - handleProgress : maj position/buffered avec offset HLS, throttling 1s display
 *  - handleEnd : autoPlay ou retour navigation
 *  - rebuffering watchdog
 *
 * Refs internes (...Ref) garantissent que les callbacks restent stables
 * pour les natifs (`useCallback` deps minimales) — sinon le release build
 * conserve la 1ʳᵉ closure et appelle une version périmée.
 */
export function useTVPlayerEventHandlers(args: {
  item?: MediaItem | null;
  playerRef: React.RefObject<MPVPlayerHandle | null>;
  paused: boolean;
  isDirectPlay: boolean;
  startTicks: number;
  positionRef: React.MutableRefObject<number>;
  pausedStateRef: React.MutableRefObject<boolean>;
  displayTimeRef: React.MutableRefObject<number>;
  bufferedTimeRef: React.MutableRefObject<number>;
  lastDisplayUpdate: React.MutableRefObject<number>;
  lastProgressTime: React.MutableRefObject<number>;
  controlsCurrentTimeRef: React.MutableRefObject<number>;
  setDisplayTime: (n: number) => void;
  setBufferedTime: (n: number) => void;
  setIsLoading: (b: boolean) => void;
  reportStart: () => void;
  updatePosition: (pos: number, paused: boolean) => void;
  autoPlay: AutoPlayCtx;
  handleFinished: () => void;
}) {
  const {
    item, playerRef, paused, isDirectPlay, startTicks,
    positionRef, pausedStateRef, displayTimeRef, bufferedTimeRef,
    lastDisplayUpdate, lastProgressTime, controlsCurrentTimeRef,
    setDisplayTime, setBufferedTime, setIsLoading,
    reportStart, updatePosition, autoPlay, handleFinished,
  } = args;

  const checkTriggerRef = useRef(autoPlay.checkTrigger);
  checkTriggerRef.current = autoPlay.checkTrigger;
  const reportStartRef = useRef(reportStart);
  reportStartRef.current = reportStart;
  const isDirectPlayRef = useRef(isDirectPlay);
  isDirectPlayRef.current = isDirectPlay;
  const startTicksRef = useRef(startTicks);
  startTicksRef.current = startTicks;
  const updatePositionRef = useRef(updatePosition);
  updatePositionRef.current = updatePosition;
  const handleFinishedRef = useRef(handleFinished);
  handleFinishedRef.current = handleFinished;
  const autoPlayRef = useRef(autoPlay);
  autoPlayRef.current = autoPlay;

  const skipProgressCountRef = useRef(0);

  const handleLoad = useCallback((_duration: number) => {
    if (isDirectPlayRef.current) {
      const resumeTicks = item?.UserData?.PlaybackPositionTicks;
      if (resumeTicks) playerRef.current?.seek(resumeTicks / TICKS_PER_SECOND);
    }
    setIsLoading(false);
    reportStartRef.current();
  }, [item, playerRef, setIsLoading]);

  const handleProgress = useCallback((currentTime: number, buffered: number) => {
    const raw = Math.max(0, currentTime);
    const offset = !isDirectPlayRef.current && startTicksRef.current > 0
      ? startTicksRef.current / TICKS_PER_SECOND : 0;
    const t = raw + offset;
    const bufferedAbs = Math.max(0, buffered) + offset;

    // Après un seek, ignorer 1 callback périmé (le natif rapporte l'ancienne pos).
    if (skipProgressCountRef.current > 0) {
      skipProgressCountRef.current--;
      bufferedTimeRef.current = bufferedAbs;
      lastProgressTime.current = Date.now();
      setIsLoading(false);
      return;
    }

    positionRef.current = t;
    controlsCurrentTimeRef.current = t;
    displayTimeRef.current = t;
    bufferedTimeRef.current = bufferedAbs;
    lastProgressTime.current = Date.now();
    setIsLoading(false);
    const now = Date.now();
    if (now - lastDisplayUpdate.current >= 1000) {
      lastDisplayUpdate.current = now;
      setDisplayTime(t);
      setBufferedTime(bufferedAbs);
    }
    updatePositionRef.current(t, pausedStateRef.current);
    checkTriggerRef.current(t);
  }, [bufferedTimeRef, controlsCurrentTimeRef, displayTimeRef, lastDisplayUpdate, lastProgressTime, pausedStateRef, positionRef, setBufferedTime, setDisplayTime, setIsLoading]);

  // Rebuffering watchdog : aucun progress callback pendant >2s
  useEffect(() => {
    if (paused) return;
    const interval = setInterval(() => {
      if (!paused && Date.now() - lastProgressTime.current > 2000) setIsLoading(true);
    }, 1000);
    return () => clearInterval(interval);
  }, [paused, lastProgressTime, setIsLoading]);

  const handleEnd = useCallback(() => {
    const ap = autoPlayRef.current;
    if (ap.nextEpisode && ap.countdown === null) ap.startAutoPlay();
    else if (ap.countdown === null) handleFinishedRef.current();
  }, []);

  return { handleLoad, handleProgress, handleEnd, skipProgressCountRef, checkTriggerRef };
}
