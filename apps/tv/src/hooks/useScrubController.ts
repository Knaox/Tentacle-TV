import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";

const SCRUB_STEP_SECONDS = 10;
/** Gap entre deux événements répétés au-delà duquel le hold est terminé */
const HOLD_RELEASE_MS = 350;
/** Paliers d'accélération du curseur selon la durée du hold (secondes) */
const SPEED_TIERS = [1, 2, 4, 8] as const;
/** Maintien ←/→ avant d'entrer en avance/recul rapide : le signal long-press
 *  système (~300ms) + ce délai ≈ 1s de maintien total. */
const SCRUB_HOLD_EXTRA_MS = 700;
/** Cadence d'avance du curseur pendant un MAINTIEN ←/→ : react-native-tvos
 *  n'émet PAS les répétitions système pendant un hold — sans ce tick JS, le
 *  scrub démarrait (pause) mais le curseur ne bougeait jamais.
 *  DOIT rester < HOLD_RELEASE_MS pour entretenir le palier d'accélération. */
const HOLD_SCRUB_TICK_MS = 250;

interface HoldState {
  dir: "forward" | "backward";
  startTime: number;
}

function getSpeedTier(holdStartTime: number): number {
  const elapsed = (Date.now() - holdStartTime) / 1000;
  const tier = Math.min(SPEED_TIERS.length - 1, Math.floor(elapsed));
  return SPEED_TIERS[tier];
}

type Ref<T> = MutableRefObject<T>;

interface ScrubControllerArgs {
  showOverlay: () => void;
  currentTimeRef: Ref<number>;
  durationRef: Ref<number>;
  onSeekRef: Ref<(seconds: number) => void>;
  onScrubPauseRef: Ref<(paused: boolean) => void>;
  overlayVisibleRef: Ref<boolean>;
  panelOpenRef: Ref<boolean>;
  /** Évite que onAnyPress ré-affiche l'OSD sur les events ←/→. */
  skipAnyPressRef: Ref<boolean>;
}

/**
 * Moteur de SCRUB du lecteur (mode « Netflix ») — PARTAGÉ Android/tvOS, extrait
 * de useTVPlayerControls (budget 300 lignes). Curseur fantôme, AUCUN seek tant
 * que non confirmé, accélération par paliers pendant un maintien. Les entrées
 * (←/→, long-press, rewind/FF côté Android ; gestes pan côté tvOS) appellent les
 * mêmes handlers exposés ici → comportement identique partout (source unique).
 */
export function useScrubController({
  showOverlay, currentTimeRef, durationRef, onSeekRef, onScrubPauseRef,
  overlayVisibleRef, panelOpenRef, skipAnyPressRef,
}: ScrubControllerArgs) {
  const [scrubbing, setScrubbing] = useState(false);
  const scrubbingRef = useRef(false);
  const [scrubPosition, setScrubPosition] = useState(0);
  const scrubPositionRef = useRef(0);

  const [speedLabel, setSpeedLabel] = useState<string | null>(null);
  const holdRef = useRef<HoldState | null>(null);
  const releaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const endHold = useCallback(() => {
    if (releaseTimerRef.current) { clearTimeout(releaseTimerRef.current); releaseTimerRef.current = null; }
    holdRef.current = null;
    setSpeedLabel(null);
  }, []);
  useEffect(() => () => endHold(), [endHold]);

  const moveScrub = useCallback((dir: "forward" | "backward") => {
    // Hold = mêmes events répétés → accélération par paliers.
    const now = Date.now();
    if (holdRef.current && holdRef.current.dir === dir) {
      const speed = getSpeedTier(holdRef.current.startTime);
      if (speed > 1) setSpeedLabel(`${dir === "forward" ? ">>" : "<<"}${speed}x`);
    } else {
      holdRef.current = { dir, startTime: now };
      setSpeedLabel(null);
    }
    if (releaseTimerRef.current) clearTimeout(releaseTimerRef.current);
    releaseTimerRef.current = setTimeout(endHold, HOLD_RELEASE_MS);

    const speed = getSpeedTier(holdRef.current.startTime);
    const delta = (dir === "forward" ? 1 : -1) * SCRUB_STEP_SECONDS * speed;
    const dur = durationRef.current || 0;
    const next = Math.max(0, dur > 0 ? Math.min(scrubPositionRef.current + delta, dur) : scrubPositionRef.current + delta);
    scrubPositionRef.current = next;
    setScrubPosition(next);
  }, [endHold, durationRef]);

  const startScrubbing = useCallback((dir?: "forward" | "backward") => {
    scrubbingRef.current = true;
    setScrubbing(true);
    scrubPositionRef.current = currentTimeRef.current;
    setScrubPosition(currentTimeRef.current);
    onScrubPauseRef.current(true);
    showOverlay();
    if (dir) moveScrub(dir);
  }, [showOverlay, moveScrub, currentTimeRef, onScrubPauseRef]);

  const confirmScrub = useCallback(() => {
    if (!scrubbingRef.current) return;
    scrubbingRef.current = false;
    setScrubbing(false);
    endHold();
    onSeekRef.current(scrubPositionRef.current);
    onScrubPauseRef.current(false);
    showOverlay();
  }, [endHold, showOverlay, onSeekRef, onScrubPauseRef]);

  const cancelScrub = useCallback(() => {
    if (!scrubbingRef.current) return;
    scrubbingRef.current = false;
    setScrubbing(false);
    endHold();
    onScrubPauseRef.current(false);
    showOverlay();
  }, [endHold, showOverlay, onScrubPauseRef]);

  // --- Maintien ←/→ : tick JS d'avance continue (le système n'émet pas les
  //     répétitions pendant un hold) + délai d'armement. ---
  const scrubHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdScrubIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const holdScrubStoppedAtRef = useRef(0);
  const stopHoldScrub = useCallback(() => {
    if (holdScrubIntervalRef.current) {
      clearInterval(holdScrubIntervalRef.current);
      holdScrubIntervalRef.current = null;
      holdScrubStoppedAtRef.current = Date.now();
    }
  }, []);
  useEffect(() => () => stopHoldScrub(), [stopHoldScrub]);

  const handleDpadDirection = useCallback((dir: "forward" | "backward") => {
    if (panelOpenRef.current) return; // panneau ouvert → D-pad au panneau
    skipAnyPressRef.current = true;
    if (scrubbingRef.current) {
      // Hold en cours (ou key-up résiduel) : avance pilotée par le tick JS —
      // les events directionnels seraient des doublons parasites.
      if (holdScrubIntervalRef.current || Date.now() - holdScrubStoppedAtRef.current < 400) return;
      moveScrub(dir);
      return;
    }
    // OSD caché → 1er appui : afficher l'OSD. Avance rapide via MAINTIEN ←/→,
    // touches rewind/FF, ou boutons ±10/30 de l'OSD.
    showOverlay();
  }, [showOverlay, moveScrub, panelOpenRef, skipAnyPressRef]);

  const handleLongDirection = useCallback((dir: "forward" | "backward") => {
    if (panelOpenRef.current || scrubbingRef.current) return;
    if (overlayVisibleRef.current) return;
    if (scrubHoldTimerRef.current) clearTimeout(scrubHoldTimerRef.current);
    scrubHoldTimerRef.current = setTimeout(() => {
      scrubHoldTimerRef.current = null;
      startScrubbing(dir);
      stopHoldScrub();
      holdScrubIntervalRef.current = setInterval(() => moveScrub(dir), HOLD_SCRUB_TICK_MS);
    }, SCRUB_HOLD_EXTRA_MS);
  }, [startScrubbing, stopHoldScrub, moveScrub, panelOpenRef, overlayVisibleRef]);

  const cancelScrubHold = useCallback(() => {
    if (scrubHoldTimerRef.current) { clearTimeout(scrubHoldTimerRef.current); scrubHoldTimerRef.current = null; }
  }, []);
  useEffect(() => () => cancelScrubHold(), [cancelScrubHold]);

  // Touches rewind/fast-forward dédiées : scrub direct, même OSD visible.
  const handleMediaSeekKey = useCallback((dir: "forward" | "backward") => {
    if (panelOpenRef.current) return;
    skipAnyPressRef.current = true;
    if (scrubbingRef.current) { moveScrub(dir); return; }
    startScrubbing(dir);
  }, [moveScrub, startScrubbing, panelOpenRef, skipAnyPressRef]);

  /** Nettoyage au key-up (fin de maintien) : stoppe tick + accélération. */
  const onHoldRelease = useCallback(() => {
    cancelScrubHold();
    stopHoldScrub();
    if (holdRef.current) endHold();
  }, [cancelScrubHold, stopHoldScrub, endHold]);

  return {
    scrubbing, scrubPosition, speedLabel, scrubbingRef,
    moveScrub, startScrubbing, confirmScrub, cancelScrub, endHold,
    handleDpadDirection, handleLongDirection, handleMediaSeekKey, onHoldRelease,
  };
}
