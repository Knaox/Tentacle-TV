import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import { getSpeedTier, SCRUB_STEP_SECONDS } from "./scrubAcceleration";
import { useButtonSeek } from "./useButtonSeek";

/** Gap entre deux événements répétés au-delà duquel le hold est terminé */
const HOLD_RELEASE_MS = 350;
/** Maintien ←/→ avant d'entrer en avance/recul rapide : le signal long-press
 *  système (~300ms) + ce délai ≈ 1s de maintien total. */
const SCRUB_HOLD_EXTRA_MS = 700;
/** Cadence d'avance du curseur pendant un MAINTIEN ←/→ : react-native-tvos
 *  n'émet PAS les répétitions système pendant un hold — sans ce tick JS, le
 *  scrub démarrait (pause) mais le curseur ne bougeait jamais.
 *  DOIT rester < HOLD_RELEASE_MS pour entretenir le palier d'accélération. */
const HOLD_SCRUB_TICK_MS = 250;
/** Délai d'INACTIVITÉ en scrub avant d'ANNULER seul (reprise à la position
 *  d'origine, AUCUN seek). Le seek ne part QUE sur confirmation explicite :
 *  OK (select), bouton ▶︎❙❙, ou relâchement d'un bouton OSD FF/RW tenu.
 *  Filet anti-seek accidentel : saisir la télécommande n'engage au pire qu'un
 *  scrub visuel qui se résorbe seul sans déplacer la lecture. */
const SCRUB_IDLE_CANCEL_MS = 7000;

interface HoldState {
  dir: "forward" | "backward";
  startTime: number;
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
  // Timer d'annulation sur inactivité (cf. armIdleCancel / endShuttleGesture).
  const idleCancelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearIdleCancel = useCallback(() => {
    if (idleCancelTimerRef.current) { clearTimeout(idleCancelTimerRef.current); idleCancelTimerRef.current = null; }
  }, []);
  useEffect(() => () => clearIdleCancel(), [clearIdleCancel]);

  const endHold = useCallback(() => {
    if (releaseTimerRef.current) { clearTimeout(releaseTimerRef.current); releaseTimerRef.current = null; }
    holdRef.current = null;
    setSpeedLabel(null);
  }, []);
  useEffect(() => () => endHold(), [endHold]);

  // confirm/cancel déclarés AVANT les mouvements : armIdleCancel (annulation sur
  // inactivité) en dépend, et chaque avance du fantôme réarme ce timer.
  const confirmScrub = useCallback(() => {
    clearIdleCancel();
    scrubViaButtonRef.current = false; setScrubViaButton(false);
    if (!scrubbingRef.current) return;
    scrubbingRef.current = false;
    setScrubbing(false);
    endHold();
    // Base des skips ±10/30 synchronisée AVANT le seek : sans ça, un +30 immédiat
    // après la confirmation repartait de la position PRÉ-scrub (currentTimeRef n'est
    // sinon rafraîchi qu'au prochain progress accepté).
    currentTimeRef.current = scrubPositionRef.current;
    onSeekRef.current(scrubPositionRef.current);
    onScrubPauseRef.current(false);
    showOverlay();
  }, [endHold, clearIdleCancel, showOverlay, onSeekRef, onScrubPauseRef, currentTimeRef]);

  const cancelScrub = useCallback(() => {
    clearIdleCancel();
    scrubViaButtonRef.current = false; setScrubViaButton(false);
    if (!scrubbingRef.current) return;
    scrubbingRef.current = false;
    setScrubbing(false);
    endHold();
    onScrubPauseRef.current(false);
    showOverlay();
  }, [endHold, clearIdleCancel, showOverlay, onScrubPauseRef]);

  /** (Ré)arme l'annulation sur inactivité : SCRUB_IDLE_CANCEL_MS sans nouvelle
   *  avance ni confirmation → cancelScrub (reprise SANS seek). Appelé à chaque
   *  mouvement du fantôme et au lever du doigt/bouton. */
  const armIdleCancel = useCallback(() => {
    clearIdleCancel();
    idleCancelTimerRef.current = setTimeout(() => {
      idleCancelTimerRef.current = null;
      cancelScrub();
    }, SCRUB_IDLE_CANCEL_MS);
  }, [clearIdleCancel, cancelScrub]);

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
    armIdleCancel();
  }, [endHold, durationRef, armIdleCancel]);

  const startScrubbing = useCallback((dir?: "forward" | "backward") => {
    // Déjà en scrub (ex. shuttle tvOS : doigt levé puis reposé) → NE PAS
    // réinitialiser la position fantôme, juste garder l'OSD. Évite le saut au
    // point de lecture live à la reprise du geste.
    if (scrubbingRef.current) { armIdleCancel(); showOverlay(); return; }
    scrubbingRef.current = true;
    setScrubbing(true);
    scrubPositionRef.current = currentTimeRef.current;
    setScrubPosition(currentTimeRef.current);
    onScrubPauseRef.current(true);
    showOverlay();
    armIdleCancel();
    if (dir) moveScrub(dir);
  }, [showOverlay, moveScrub, currentTimeRef, onScrubPauseRef, armIdleCancel]);

  // Avance CONTINUE de la position fantôme (modèle shuttle tvOS) : delta signé en
  // secondes, clamp [0, durée]. N'utilise PAS les paliers de maintien (réservés au
  // D-pad Android) — la vitesse est calculée par l'adaptateur de gestes.
  const nudgeScrub = useCallback((deltaSeconds: number) => {
    armIdleCancel(); // nouvelle avance → repousse l'annulation sur inactivité
    const dur = durationRef.current || 0;
    const next = Math.max(0, dur > 0
      ? Math.min(scrubPositionRef.current + deltaSeconds, dur)
      : scrubPositionRef.current + deltaSeconds);
    scrubPositionRef.current = next;
    setScrubPosition(next);
  }, [durationRef, armIdleCancel]);

  // Shuttle tvOS : le doigt se lève (geste pan « Ended »). Le scrub RESTE
  // ouvert : OK / ▶︎❙❙ VALIDENT le seek, BACK annule, et l'inactivité
  // (armIdleCancel) annule seule SANS seek — saisir la télécommande ne déplace
  // plus jamais la lecture. (Avant : auto-validation du seek 800 ms après le
  // lever du doigt → seeks accidentels de quelques secondes.)
  const endShuttleGesture = useCallback(() => {
    endHold();
    if (!scrubbingRef.current) return;
    armIdleCancel();
  }, [endHold, armIdleCancel]);

  const { startButtonSeek, stopButtonSeek } = useButtonSeek({
    durationRef, startScrubbing, nudgeScrub, confirmScrub, clearIdleCancel,
    scrubbingRef, scrubViaButtonRef, setScrubViaButton, setSpeedLabel,
  });

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

  /** Nettoyage au key-up (fin de maintien) : stoppe tick + accélération. Un
   *  scrub laissé ouvert s'annulera seul sur inactivité (aucun seek). */
  const onHoldRelease = useCallback(() => {
    cancelScrubHold();
    stopHoldScrub();
    if (holdRef.current) endHold();
    if (scrubbingRef.current) armIdleCancel();
  }, [cancelScrubHold, stopHoldScrub, endHold, armIdleCancel]);

  return {
    scrubbing, scrubPosition, speedLabel, scrubbingRef, scrubViaButton,
    moveScrub, nudgeScrub, setSpeedLabel, startScrubbing, confirmScrub, cancelScrub, endHold, endShuttleGesture,
    startButtonSeek, stopButtonSeek,
    handleDpadDirection, handleLongDirection, handleMediaSeekKey, onHoldRelease,
  };
}
