import { useState, useRef, useCallback, useEffect } from "react";
import { useTVRemote } from "../components/focus/useTVRemote";

const SPEED_STEPS = [2, 4, 8, 16] as const;
const SCRUB_STEP_SECONDS = 10;
const OVERLAY_HIDE_MS = 5000;

interface TVPlayerControlsOptions {
  paused: boolean;
  jellyfinDuration: number;
  onSeek: (seconds: number) => void;
  onBack: () => void;
  onPlayPause: () => void;
}

export function useTVPlayerControls({
  paused, jellyfinDuration, onSeek, onBack, onPlayPause,
}: TVPlayerControlsOptions) {
  const currentTimeRef = useRef(0);

  // --- Overlay visibility ---
  const [overlayVisible, setOverlayVisible] = useState(true);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showOverlay = useCallback(() => {
    setOverlayVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (!paused) {
      hideTimerRef.current = setTimeout(() => setOverlayVisible(false), OVERLAY_HIDE_MS);
    }
  }, [paused]);

  useEffect(() => {
    showOverlay();
    return () => { if (hideTimerRef.current) clearTimeout(hideTimerRef.current); };
  }, [paused, showOverlay]);

  // --- Fast forward / rewind ---
  const [speedLabel, setSpeedLabel] = useState<string | null>(null);
  const speedIdx = useRef(-1); // -1 = normal playback
  const fastDir = useRef<"forward" | "backward" | null>(null);
  const fastTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopFastMode = useCallback(() => {
    if (fastTimer.current) { clearInterval(fastTimer.current); fastTimer.current = null; }
    speedIdx.current = -1;
    fastDir.current = null;
    setSpeedLabel(null);
  }, []);

  const startFastMode = useCallback((dir: "forward" | "backward") => {
    if (fastDir.current === dir) {
      // Increase speed
      speedIdx.current = Math.min(speedIdx.current + 1, SPEED_STEPS.length - 1);
    } else {
      speedIdx.current = 0;
      fastDir.current = dir;
    }
    const speed = SPEED_STEPS[speedIdx.current];
    const prefix = dir === "forward" ? ">>" : "<<";
    setSpeedLabel(`${prefix}${speed}x`);

    // Move position at the current speed
    if (fastTimer.current) clearInterval(fastTimer.current);
    fastTimer.current = setInterval(() => {
      const delta = (dir === "forward" ? 1 : -1) * speed;
      const target = currentTimeRef.current + delta;
      const dur = jellyfinDuration || 0;
      const clamped = Math.max(0, dur > 0 ? Math.min(target, dur) : target);
      currentTimeRef.current = clamped;
      onSeek(clamped);
    }, 500);
  }, [jellyfinDuration, onSeek]);

  // Cleanup fast mode on unmount
  useEffect(() => () => stopFastMode(), [stopFastMode]);

  // --- Scrubbing mode (progress bar) ---
  const [scrubbing, setScrubbing] = useState(false);
  const [scrubPosition, setScrubPosition] = useState(0);

  const startScrubbing = useCallback(() => {
    setScrubbing(true);
    setScrubPosition(currentTimeRef.current);
    showOverlay();
  }, [showOverlay]);

  const moveScrub = useCallback((dir: "forward" | "backward") => {
    setScrubPosition((prev) => {
      const dur = jellyfinDuration || 0;
      const delta = dir === "forward" ? SCRUB_STEP_SECONDS : -SCRUB_STEP_SECONDS;
      return Math.max(0, dur > 0 ? Math.min(prev + delta, dur) : prev + delta);
    });
  }, [jellyfinDuration]);

  const confirmScrub = useCallback(() => {
    onSeek(scrubPosition);
    setScrubbing(false);
  }, [onSeek, scrubPosition]);

  const cancelScrub = useCallback(() => {
    setScrubbing(false);
  }, []);

  // --- Ref-based skip (avoids stale closures) ---
  const handleSkipForward = useCallback(() => {
    if (fastDir.current) { stopFastMode(); return; }
    const dur = jellyfinDuration || 0;
    const target = currentTimeRef.current + 30;
    const clamped = Math.max(0, dur > 0 ? Math.min(target, dur) : target);
    onSeek(clamped);
  }, [jellyfinDuration, onSeek, stopFastMode]);

  const handleSkipBack = useCallback(() => {
    if (fastDir.current) { stopFastMode(); return; }
    const target = currentTimeRef.current - 10;
    onSeek(Math.max(0, target));
  }, [onSeek, stopFastMode]);

  // --- D-pad handling ---
  const handleDpadLeft = useCallback(() => {
    if (scrubbing) { moveScrub("backward"); return; }
    handleSkipBack();
    showOverlay();
  }, [scrubbing, moveScrub, handleSkipBack, showOverlay]);

  const handleDpadRight = useCallback(() => {
    if (scrubbing) { moveScrub("forward"); return; }
    handleSkipForward();
    showOverlay();
  }, [scrubbing, moveScrub, handleSkipForward, showOverlay]);

  const handleDpadDown = useCallback(() => {
    if (!scrubbing) startScrubbing();
    showOverlay();
  }, [scrubbing, startScrubbing, showOverlay]);

  useTVRemote({
    onBack: () => {
      if (scrubbing) { cancelScrub(); return; }
      if (fastDir.current) { stopFastMode(); return; }
      onBack();
    },
    onPlayPause: () => {
      if (scrubbing) { confirmScrub(); return; }
      if (fastDir.current) { stopFastMode(); return; }
      onPlayPause();
      showOverlay();
    },
    onLeft: handleDpadLeft,
    onRight: handleDpadRight,
    onDown: handleDpadDown,
    onUp: showOverlay,
    onAnyPress: showOverlay,
  });

  return {
    currentTimeRef,
    overlayVisible,
    showOverlay,
    speedLabel,
    scrubbing,
    scrubPosition,
    handleSkipForward,
    handleSkipBack,
    startFastMode,
    stopFastMode,
  };
}
