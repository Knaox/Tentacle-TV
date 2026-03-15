import { useState, useRef, useCallback, useEffect } from "react";
import { useTVRemote } from "../components/focus/useTVRemote";

const SCRUB_STEP_SECONDS = 10;
const OVERLAY_HIDE_MS = 5000;
/** Time to distinguish short press from hold (system key repeat delay is ~400ms) */
const RELEASE_TIMEOUT_MS = 350;
/** Interval for progressive seek during hold */
const HOLD_TICK_MS = 200;
/** Base seek delta per tick (seconds). At 1x → 2s/tick → 10s/sec of hold */
const HOLD_BASE_DELTA = 2;
/** Exponential speed tiers based on hold duration (seconds) */
const SPEED_TIERS = [1, 2, 4, 8] as const;

interface TVPlayerControlsOptions {
  paused: boolean;
  jellyfinDuration: number;
  onSeek: (seconds: number) => void;
  onBack: () => void;
  onPlayPause: () => void;
  seekBarFocusedRef: React.RefObject<boolean>;
  /** When true, overlay auto-hide timer is suspended (e.g. track selector open) */
  settingsOpen?: boolean;
}

interface HoldState {
  dir: "forward" | "backward";
  startTime: number;
  eventCount: number;
}

function getSpeedTier(holdStartTime: number): number {
  const elapsed = (Date.now() - holdStartTime) / 1000;
  const tier = Math.min(SPEED_TIERS.length - 1, Math.floor(elapsed));
  return SPEED_TIERS[tier];
}

export function useTVPlayerControls({
  paused, jellyfinDuration, onSeek, onBack, onPlayPause, seekBarFocusedRef,
  settingsOpen = false,
}: TVPlayerControlsOptions) {
  const currentTimeRef = useRef(0);

  // Stable refs for timer/interval callbacks (avoid stale closures)
  const durationRef = useRef(jellyfinDuration);
  durationRef.current = jellyfinDuration;
  const onSeekRef = useRef(onSeek);
  onSeekRef.current = onSeek;

  // --- Overlay visibility ---
  const [overlayVisible, setOverlayVisible] = useState(true);
  const overlayVisibleRef = useRef(true);
  overlayVisibleRef.current = overlayVisible;
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** When true, seekbar gets focus instead of play/pause button */
  const [seekActive, setSeekActive] = useState(false);
  /** Timestamp of last showOverlay call — used to debounce playPause events */
  const lastShowOverlayRef = useRef(0);

  const showOverlay = useCallback(() => {
    lastShowOverlayRef.current = Date.now();
    setOverlayVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (!paused && !settingsOpen) {
      hideTimerRef.current = setTimeout(() => {
        setOverlayVisible(false);
        setSeekActive(false);
      }, OVERLAY_HIDE_MS);
    }
  }, [paused, settingsOpen]);

  useEffect(() => {
    showOverlay();
    return () => { if (hideTimerRef.current) clearTimeout(hideTimerRef.current); };
  }, [paused, showOverlay]);

  // --- Hold-based progressive seek ---
  const [speedLabel, setSpeedLabel] = useState<string | null>(null);
  const holdRef = useRef<HoldState | null>(null);
  const releaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seekIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /** Prevents onAnyPress from showing overlay on D-pad left/right events */
  const skipAnyPressRef = useRef(false);

  const stopHold = useCallback(() => {
    if (releaseTimerRef.current) { clearTimeout(releaseTimerRef.current); releaseTimerRef.current = null; }
    if (seekIntervalRef.current) { clearInterval(seekIntervalRef.current); seekIntervalRef.current = null; }
    holdRef.current = null;
    setSpeedLabel(null);
    // Restart auto-hide timer now that acceleration has stopped
    showOverlay();
  }, [showOverlay]);

  const startAcceleration = useCallback((dir: "forward" | "backward") => {
    if (seekIntervalRef.current) clearInterval(seekIntervalRef.current);
    seekIntervalRef.current = setInterval(() => {
      if (!holdRef.current) return;
      // Keep overlay visible during acceleration — clear the auto-hide timer
      if (hideTimerRef.current) { clearTimeout(hideTimerRef.current); hideTimerRef.current = null; }
      const speed = getSpeedTier(holdRef.current.startTime);
      const delta = (dir === "forward" ? 1 : -1) * speed * HOLD_BASE_DELTA;
      const target = currentTimeRef.current + delta;
      const dur = durationRef.current || 0;
      const clamped = Math.max(0, dur > 0 ? Math.min(target, dur) : target);
      currentTimeRef.current = clamped;
      onSeekRef.current(clamped);
      const prefix = dir === "forward" ? ">>" : "<<";
      setSpeedLabel(`${prefix}${speed}x`);
    }, HOLD_TICK_MS);
  }, []);

  useEffect(() => () => stopHold(), [stopHold]);

  // Release handler — uses refs so setTimeout always calls latest logic
  const stopHoldStable = useRef(stopHold);
  stopHoldStable.current = stopHold;

  const handleRelease = useCallback(() => {
    console.log("[PlayerControls] handleRelease, hold:", holdRef.current?.eventCount);
    if (!holdRef.current) return;
    stopHoldStable.current();
  }, []);

  // --- Scrubbing mode ---
  const [scrubbing, setScrubbing] = useState(false);
  const [scrubPosition, setScrubPosition] = useState(0);
  const scrubbingRef = useRef(false);

  const startScrubbing = useCallback(() => {
    setScrubbing(true);
    scrubbingRef.current = true;
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
    scrubbingRef.current = false;
  }, [onSeek, scrubPosition]);

  const cancelScrub = useCallback(() => {
    setScrubbing(false);
    scrubbingRef.current = false;
  }, []);

  // --- D-pad direction handler (core hold detection) ---
  const handleDpadDirection = useCallback((dir: "forward" | "backward") => {
    console.log("[PlayerControls] handleDpadDirection:", dir, "overlay:", overlayVisibleRef.current, "hold:", holdRef.current?.eventCount, "scrub:", scrubbingRef.current);
    skipAnyPressRef.current = true;
    if (scrubbingRef.current) { moveScrub(dir); return; }

    // Overlay visible + transport button focused (not seekbar) → let focus engine navigate
    if (overlayVisibleRef.current && !seekBarFocusedRef.current) {
      showOverlay();
      return;
    }

    // Already in active acceleration — just reset release timer
    if (holdRef.current && holdRef.current.dir === dir && holdRef.current.eventCount > 1) {
      console.log("[PlayerControls] acceleration active, reset timer");
      if (releaseTimerRef.current) clearTimeout(releaseTimerRef.current);
      releaseTimerRef.current = setTimeout(handleRelease, RELEASE_TIMEOUT_MS);
      return;
    }

    if (!holdRef.current) {
      // First event — immediate seek +30s / -10s
      const dur = durationRef.current || 0;
      if (dir === "forward") {
        const target = currentTimeRef.current + 30;
        const clamped = Math.max(0, dur > 0 ? Math.min(target, dur) : target);
        console.log("[PlayerControls] SEEK forward:", currentTimeRef.current, "→", clamped);
        currentTimeRef.current = clamped;
        onSeekRef.current(clamped);
      } else {
        const clamped = Math.max(0, currentTimeRef.current - 10);
        console.log("[PlayerControls] SEEK backward:", currentTimeRef.current, "→", clamped);
        currentTimeRef.current = clamped;
        onSeekRef.current(clamped);
      }
      setSeekActive(true);
      showOverlay();
      holdRef.current = { dir, startTime: Date.now(), eventCount: 1 };
    } else if (holdRef.current.dir === dir) {
      // Second event (same direction) = hold detected → start acceleration
      holdRef.current.eventCount = 2;
      startAcceleration(dir);
      showOverlay();
    } else {
      // Direction changed mid-hold — immediate seek in new direction
      stopHold();
      const dur = durationRef.current || 0;
      if (dir === "forward") {
        const target = currentTimeRef.current + 30;
        const clamped = Math.max(0, dur > 0 ? Math.min(target, dur) : target);
        currentTimeRef.current = clamped;
        onSeekRef.current(clamped);
      } else {
        const clamped = Math.max(0, currentTimeRef.current - 10);
        currentTimeRef.current = clamped;
        onSeekRef.current(clamped);
      }
      setSeekActive(true);
      showOverlay();
      holdRef.current = { dir, startTime: Date.now(), eventCount: 1 };
    }

    if (releaseTimerRef.current) clearTimeout(releaseTimerRef.current);
    releaseTimerRef.current = setTimeout(handleRelease, RELEASE_TIMEOUT_MS);
  }, [moveScrub, stopHold, startAcceleration, handleRelease, showOverlay]);

  const handleDpadDown = useCallback(() => {
    if (overlayVisibleRef.current) return;
    if (!scrubbingRef.current) startScrubbing();
    showOverlay();
  }, [startScrubbing, showOverlay]);

  // --- Skip buttons (overlay transport controls) ---
  const handleSkipForward = useCallback(() => {
    if (holdRef.current) { stopHold(); return; }
    const dur = jellyfinDuration || 0;
    const target = currentTimeRef.current + 30;
    const clamped = Math.max(0, dur > 0 ? Math.min(target, dur) : target);
    onSeek(clamped);
  }, [jellyfinDuration, onSeek, stopHold]);

  const handleSkipBack = useCallback(() => {
    if (holdRef.current) { stopHold(); return; }
    const target = currentTimeRef.current - 10;
    onSeek(Math.max(0, target));
  }, [onSeek, stopHold]);

  // --- TV Remote binding ---
  useTVRemote({
    onBack: () => {
      if (holdRef.current) { stopHold(); return; }
      if (scrubbing) { cancelScrub(); return; }
      onBack();
    },
    onPlayPause: () => {
      if (holdRef.current) { stopHold(); return; }
      if (scrubbing) { confirmScrub(); return; }
      // If overlay is hidden, first press just shows it (no pause toggle).
      // Also block for 300ms after showOverlay to prevent double-event from
      // Shield remote firing both "select" (→ showOverlay) and "playPause".
      if (!overlayVisibleRef.current || (Date.now() - lastShowOverlayRef.current < 300)) {
        showOverlay();
        return;
      }
      onPlayPause();
      showOverlay();
    },
    onLeft: () => { console.log("[PlayerControls] onLeft"); handleDpadDirection("backward"); },
    onRight: () => { console.log("[PlayerControls] onRight"); handleDpadDirection("forward"); },
    onLongRight: () => {
      console.log("[PlayerControls] onLongRight");
      if (scrubbingRef.current) return;
      if (overlayVisibleRef.current && !seekBarFocusedRef.current) return;
      if (releaseTimerRef.current) { clearTimeout(releaseTimerRef.current); releaseTimerRef.current = null; }
      holdRef.current = { dir: "forward", startTime: Date.now(), eventCount: 2 };
      startAcceleration("forward");
      setSeekActive(true);
      showOverlay();
    },
    onLongLeft: () => {
      console.log("[PlayerControls] onLongLeft");
      if (scrubbingRef.current) return;
      if (overlayVisibleRef.current && !seekBarFocusedRef.current) return;
      if (releaseTimerRef.current) { clearTimeout(releaseTimerRef.current); releaseTimerRef.current = null; }
      holdRef.current = { dir: "backward", startTime: Date.now(), eventCount: 2 };
      startAcceleration("backward");
      setSeekActive(true);
      showOverlay();
    },
    onRewind: () => { console.log("[PlayerControls] onRewind"); handleDpadDirection("backward"); },
    onFastForward: () => { console.log("[PlayerControls] onFastForward"); handleDpadDirection("forward"); },
    onKeyUp: () => {
      console.log("[PlayerControls] onKeyUp, hold:", holdRef.current?.eventCount);
      if (holdRef.current && holdRef.current.eventCount > 1) stopHold();
    },
    onDown: handleDpadDown,
    onUp: showOverlay,
    onAnyPress: () => {
      if (skipAnyPressRef.current) { skipAnyPressRef.current = false; return; }
      if (holdRef.current && holdRef.current.eventCount > 1) { stopHold(); return; }
      showOverlay();
    },
  });

  return {
    currentTimeRef,
    overlayVisible,
    showOverlay,
    seekActive,
    speedLabel,
    scrubbing,
    scrubPosition,
    handleSkipForward,
    handleSkipBack,
  };
}
