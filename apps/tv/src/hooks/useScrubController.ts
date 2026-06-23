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
/** Shuttle tvOS : délai d'inactivité après le lever du doigt avant de VALIDER
 *  seul le scrub (seek + reprise). Assez long pour reposer le doigt et continuer
 *  (trackpad fini), assez court pour que « j'arrête → ça repart » soit fluide. */
const SHUTTLE_AUTO_CONFIRM_MS = 800;

interface HoldState {
  dir: "forward" | "backward";
  startTime: number;
}

function getSpeedTier(holdStartTime: number): number {
  const elapsed = (Date.now() - holdStartTime) / 1000;
  const tier = Math.min(SPEED_TIERS.length - 1, Math.floor(elapsed));
  return SPEED_TIERS[tier];
}

/** Saut de base d'un appui-bouton FF/rewind (avant que la rampe ne démarre). */
const BUTTON_SEEK_BASE = 10;
/** Rampe d'avance au MAINTIEN d'un bouton FF/rewind : vitesse (s vidéo / s réelle)
 *  selon la durée du maintien — de plus en plus rapide. */
function buttonSeekRate(heldSec: number, durationSec: number): number {
  if (heldSec < 0.35) return 0;   // avant rampe : seul le saut de base s'applique
  // Rampe ∝ durée (bornée 5–400 s/s) : traverse la vidéo en ~30 s à fond → court = lent, long = rapide.
  const maxRate = Math.min(400, Math.max(5, (durationSec || 0) / 30));
  if (heldSec < 1.2) return maxRate * 0.18;
  if (heldSec < 2.2) return maxRate * 0.45;
  if (heldSec < 3.5) return maxRate * 0.75;
  return maxRate;
}
function buttonSeekTier(heldSec: number): number {
  if (heldSec < 1.2) return 1;
  if (heldSec < 2.2) return 2;
  if (heldSec < 3.5) return 4;
  return 8;
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
  // Scrub initié par un BOUTON OSD maintenu (FF/rewind) : le focus doit RESTER sur
  // le bouton tenu → on supprime le verrou focus→play/pause de l'OSD dans ce cas.
  const [scrubViaButton, setScrubViaButton] = useState(false);
  const scrubViaButtonRef = useRef(false);

  const [speedLabel, setSpeedLabel] = useState<string | null>(null);
  const holdRef = useRef<HoldState | null>(null);
  const releaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Timer d'auto-validation du shuttle (cf. endShuttleGesture).
  const autoConfirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearAutoConfirm = useCallback(() => {
    if (autoConfirmTimerRef.current) { clearTimeout(autoConfirmTimerRef.current); autoConfirmTimerRef.current = null; }
  }, []);
  useEffect(() => () => clearAutoConfirm(), [clearAutoConfirm]);

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
    // Déjà en scrub (ex. shuttle tvOS : doigt levé puis reposé) → NE PAS
    // réinitialiser la position fantôme, juste garder l'OSD. Évite le saut au
    // point de lecture live à la reprise du geste.
    if (scrubbingRef.current) { clearAutoConfirm(); showOverlay(); return; }
    scrubbingRef.current = true;
    setScrubbing(true);
    scrubPositionRef.current = currentTimeRef.current;
    setScrubPosition(currentTimeRef.current);
    onScrubPauseRef.current(true);
    showOverlay();
    if (dir) moveScrub(dir);
  }, [showOverlay, moveScrub, currentTimeRef, onScrubPauseRef, clearAutoConfirm]);

  // Avance CONTINUE de la position fantôme (modèle shuttle tvOS) : delta signé en
  // secondes, clamp [0, durée]. N'utilise PAS les paliers de maintien (réservés au
  // D-pad Android) — la vitesse est calculée par l'adaptateur de gestes.
  const nudgeScrub = useCallback((deltaSeconds: number) => {
    clearAutoConfirm(); // nouvelle avance → annule l'auto-validation en attente
    const dur = durationRef.current || 0;
    const next = Math.max(0, dur > 0
      ? Math.min(scrubPositionRef.current + deltaSeconds, dur)
      : scrubPositionRef.current + deltaSeconds);
    scrubPositionRef.current = next;
    setScrubPosition(next);
  }, [durationRef, clearAutoConfirm]);

  const confirmScrub = useCallback(() => {
    clearAutoConfirm();
    scrubViaButtonRef.current = false; setScrubViaButton(false);
    if (!scrubbingRef.current) return;
    scrubbingRef.current = false;
    setScrubbing(false);
    endHold();
    onSeekRef.current(scrubPositionRef.current);
    onScrubPauseRef.current(false);
    showOverlay();
  }, [endHold, clearAutoConfirm, showOverlay, onSeekRef, onScrubPauseRef]);

  const cancelScrub = useCallback(() => {
    clearAutoConfirm();
    scrubViaButtonRef.current = false; setScrubViaButton(false);
    if (!scrubbingRef.current) return;
    scrubbingRef.current = false;
    setScrubbing(false);
    endHold();
    onScrubPauseRef.current(false);
    showOverlay();
  }, [endHold, clearAutoConfirm, showOverlay, onScrubPauseRef]);

  // Shuttle tvOS : le doigt se lève (geste pan « Ended »). On NE valide PAS
  // immédiatement (la surface du trackpad est finie → on peut reposer le doigt
  // et continuer) : on arme une courte fenêtre d'inactivité, puis on valide seul
  // le seek + la reprise. Toute nouvelle avance (nudgeScrub) annule ce timer.
  // Évite d'avoir à appuyer sur play après une avance rapide.
  const endShuttleGesture = useCallback(() => {
    endHold();
    clearAutoConfirm();
    if (!scrubbingRef.current) return;
    autoConfirmTimerRef.current = setTimeout(() => {
      autoConfirmTimerRef.current = null;
      confirmScrub();
    }, SHUTTLE_AUTO_CONFIRM_MS);
  }, [endHold, clearAutoConfirm, confirmScrub]);

  // Boutons OSD avance/recul rapide dédiés, modèle MAINTIEN : curseur fantôme qui
  // avance de plus en plus vite tant que le bouton est tenu (rampe), seek + reprise
  // au relâchement. Le focus reste sur le bouton (scrubViaButton → pas de verrou).
  const buttonLoopRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopButtonLoop = useCallback(() => {
    if (buttonLoopRef.current) { clearInterval(buttonLoopRef.current); buttonLoopRef.current = null; }
  }, []);
  useEffect(() => () => stopButtonLoop(), [stopButtonLoop]);

  const startButtonSeek = useCallback((dir: "forward" | "backward") => {
    if (buttonLoopRef.current) return; // déjà en maintien
    const sign = dir === "forward" ? 1 : -1;
    clearAutoConfirm();
    scrubViaButtonRef.current = true; setScrubViaButton(true);
    if (!scrubbingRef.current) startScrubbing();   // ghost-scrub (pause), sans dir → pas de moveScrub
    nudgeScrub(sign * BUTTON_SEEK_BASE);           // saut de base immédiat (tap = petit saut)
    setSpeedLabel(`${sign > 0 ? "▶▶" : "◀◀"} 1x`);
    const start = Date.now();
    let last = start;
    buttonLoopRef.current = setInterval(() => {
      const now = Date.now();
      const dt = (now - last) / 1000;
      last = now;
      const held = (now - start) / 1000;
      const rate = buttonSeekRate(held, durationRef.current);
      if (rate > 0) {
        nudgeScrub(sign * rate * dt);
        setSpeedLabel(`${sign > 0 ? "▶▶" : "◀◀"} ${buttonSeekTier(held)}x`);
      }
    }, 33);
  }, [clearAutoConfirm, startScrubbing, nudgeScrub]);

  const stopButtonSeek = useCallback(() => {
    if (!buttonLoopRef.current && !scrubViaButtonRef.current) return;
    stopButtonLoop();
    confirmScrub();   // seek vers la position fantôme + reprise (+ reset scrubViaButton)
  }, [stopButtonLoop, confirmScrub]);

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
    scrubbing, scrubPosition, speedLabel, scrubbingRef, scrubViaButton,
    moveScrub, nudgeScrub, setSpeedLabel, startScrubbing, confirmScrub, cancelScrub, endHold, endShuttleGesture,
    startButtonSeek, stopButtonSeek,
    handleDpadDirection, handleLongDirection, handleMediaSeekKey, onHoldRelease,
  };
}
