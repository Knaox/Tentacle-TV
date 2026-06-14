import { useState, useRef, useCallback, useEffect } from "react";
import { useTVRemote } from "../components/focus/useTVRemote";

const SCRUB_STEP_SECONDS = 10;
const OVERLAY_HIDE_MS = 5000;
/** Gap entre deux événements répétés au-delà duquel le hold est terminé */
const HOLD_RELEASE_MS = 350;
/** Paliers d'accélération du curseur selon la durée du hold (secondes) */
const SPEED_TIERS = [1, 2, 4, 8] as const;
/** Fenêtre du double-clic ←/→ (OSD caché) : 2e appui entre 120 et 500ms.
 *  < 120ms = auto-repeat système (maintien) → géré par le long-press. */
const DOUBLE_TAP_MIN_MS = 120;
const DOUBLE_TAP_MAX_MS = 500;
/** Maintien ←/→ avant d'entrer en avance/recul rapide : le signal long-press
 *  système (~300ms) + ce délai ≈ 1s de maintien total (« juste milieu » :
 *  ni déclenché par un appui un peu long, ni trop d'attente). */
const SCRUB_HOLD_EXTRA_MS = 700;
/** Durée d'affichage du badge « +30s / −10s » après un skip OSD caché */
const SKIP_BADGE_MS = 1000;
/** Cadence d'avance du curseur pendant un MAINTIEN ←/→ : react-native-tvos
 *  n'émet PAS les répétitions système pendant un hold — sans ce tick JS, le
 *  scrub démarrait (pause) mais le curseur ne bougeait jamais.
 *  DOIT rester < HOLD_RELEASE_MS pour entretenir le palier d'accélération. */
const HOLD_SCRUB_TICK_MS = 250;
/** Hold OK depuis l'OSD caché : le Pressable du bouton (re)focalisé déclenche
 *  son onPress au relâchement du MÊME appui → action involontaire. On avale ce
 *  press jusqu'au key-up du select (fin réelle du hold) ; ce délai est le filet
 *  de sécurité si aucun press n'arrive (appui court). Calé au-delà du settle
 *  350ms de restoringFocusRef (TVPlayerOverlay). */
const REVEAL_SWALLOW_MAX_MS = 400;
/** Grâce après le key-up du select : absorbe l'incertitude d'ordre entre le
 *  onPress (Pressable) et le onKeyUp (useTVEventHandler). */
const KEYUP_GRACE_MS = 120;

interface TVPlayerControlsOptions {
  paused: boolean;
  jellyfinDuration: number;
  onSeek: (seconds: number) => void;
  onBack: () => void;
  onPlayPause: () => void;
  /** Pause la lecture à l'entrée en mode scrub, reprend à la sortie. */
  onScrubPause: (paused: boolean) => void;
  /** Panneau au-dessus du lecteur (paramètres, épisodes) : suspend l'auto-hide
   *  ET neutralise les events D-pad du lecteur (sinon ←/→ scrubbent la lecture
   *  pendant qu'on navigue dans le panneau). */
  panelOpen?: boolean;
}

interface HoldState {
  dir: "forward" | "backward";
  startTime: number;
}

function getSpeedTier(holdStartTime: number): number {
  const elapsed = (Date.now() - holdStartTime) / 1000;
  const tier = Math.min(SPEED_TIERS.length - 1, Math.floor(elapsed));
  return SPEED_TIERS[tier];
}

/**
 * Contrôles télécommande du lecteur — modèle « Netflix » :
 *  - ←/→ ne seekent JAMAIS la lecture. OSD visible → navigation entre boutons ;
 *    OSD caché (ou touches rewind/FF) → mode SCRUB : la lecture se met en pause,
 *    un curseur fantôme (+ vignette trickplay) se déplace de ±10s par appui,
 *    avec accélération par paliers pendant un hold. OK = seek + reprise ;
 *    BACK = annule + reprise.
 *  - La seekbar n'est jamais focusable : le seek réel n'arrive qu'à la
 *    confirmation (un seul onSeek, pas de spam réseau pendant l'avance).
 */
export function useTVPlayerControls({
  paused, jellyfinDuration, onSeek, onBack, onPlayPause, onScrubPause,
  panelOpen = false,
}: TVPlayerControlsOptions) {
  const currentTimeRef = useRef(0);
  const panelOpenRef = useRef(panelOpen);
  panelOpenRef.current = panelOpen;

  // Stable refs for timer/interval callbacks (avoid stale closures)
  const durationRef = useRef(jellyfinDuration);
  durationRef.current = jellyfinDuration;
  const onSeekRef = useRef(onSeek);
  onSeekRef.current = onSeek;
  const onScrubPauseRef = useRef(onScrubPause);
  onScrubPauseRef.current = onScrubPause;

  // --- Overlay visibility ---
  const [overlayVisible, setOverlayVisible] = useState(true);
  const overlayVisibleRef = useRef(true);
  overlayVisibleRef.current = overlayVisible;
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Timestamp of last showOverlay call — used to debounce playPause events */
  const lastShowOverlayRef = useRef(0);
  /** Armé quand showOverlay révèle l'OSD (caché→visible) : avale le 1er onPress
   *  de bouton issu du même hold OK. Désarmé au key-up du select. */
  const swallowButtonPressRef = useRef(false);
  const swallowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showOverlay = useCallback(() => {
    const wasHidden = !overlayVisibleRef.current;
    lastShowOverlayRef.current = Date.now();
    setOverlayVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (!paused && !panelOpen) {
      hideTimerRef.current = setTimeout(() => {
        setOverlayVisible(false);
      }, OVERLAY_HIDE_MS);
    }
    // Révélation depuis l'état caché : armer l'avalement du press parasite.
    if (wasHidden) {
      swallowButtonPressRef.current = true;
      if (swallowTimerRef.current) clearTimeout(swallowTimerRef.current);
      swallowTimerRef.current = setTimeout(() => {
        swallowButtonPressRef.current = false;
        swallowTimerRef.current = null;
      }, REVEAL_SWALLOW_MAX_MS);
    }
  }, [paused, panelOpen]);

  useEffect(() => {
    showOverlay();
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      if (swallowTimerRef.current) clearTimeout(swallowTimerRef.current);
    };
  }, [paused, showOverlay]);

  // --- Mode scrub (curseur fantôme, AUCUN seek tant que non confirmé) ---
  const [scrubbing, setScrubbing] = useState(false);
  const scrubbingRef = useRef(false);
  const [scrubPosition, setScrubPosition] = useState(0);
  const scrubPositionRef = useRef(0);

  const [speedLabel, setSpeedLabel] = useState<string | null>(null);
  const holdRef = useRef<HoldState | null>(null);
  const releaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Prevents onAnyPress from re-showing overlay on D-pad left/right events */
  const skipAnyPressRef = useRef(false);

  const endHold = useCallback(() => {
    if (releaseTimerRef.current) { clearTimeout(releaseTimerRef.current); releaseTimerRef.current = null; }
    holdRef.current = null;
    setSpeedLabel(null);
  }, []);

  useEffect(() => () => endHold(), [endHold]);

  const moveScrub = useCallback((dir: "forward" | "backward") => {
    // Hold = mêmes events répétés par le système → accélération par paliers.
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
  }, [endHold]);

  const startScrubbing = useCallback((dir?: "forward" | "backward") => {
    scrubbingRef.current = true;
    setScrubbing(true);
    scrubPositionRef.current = currentTimeRef.current;
    setScrubPosition(currentTimeRef.current);
    onScrubPauseRef.current(true);
    showOverlay();
    if (dir) moveScrub(dir);
  }, [showOverlay, moveScrub]);

  const confirmScrub = useCallback(() => {
    if (!scrubbingRef.current) return;
    scrubbingRef.current = false;
    setScrubbing(false);
    endHold();
    onSeekRef.current(scrubPositionRef.current);
    onScrubPauseRef.current(false);
    showOverlay();
  }, [endHold, showOverlay]);

  const cancelScrub = useCallback(() => {
    if (!scrubbingRef.current) return;
    scrubbingRef.current = false;
    setScrubbing(false);
    endHold();
    onScrubPauseRef.current(false);
    showOverlay();
  }, [endHold, showOverlay]);

  /** Garde pour les boutons OSD : en scrub, OK valide le scrub au lieu d'agir. */
  const guardScrub = useCallback(<T extends unknown[]>(fn: (...args: T) => void) =>
    (...args: T) => {
      if (scrubbingRef.current) { confirmScrub(); return; }
      fn(...args);
    }, [confirmScrub]);

  /** Avale le press parasite issu du hold OK qui vient de révéler l'OSD
   *  (consomme UN seul press) — sinon le relâchement active le bouton focalisé. */
  const guardReveal = useCallback(<T extends unknown[]>(fn: (...args: T) => void) =>
    (...args: T) => {
      if (swallowButtonPressRef.current) {
        swallowButtonPressRef.current = false;
        if (swallowTimerRef.current) { clearTimeout(swallowTimerRef.current); swallowTimerRef.current = null; }
        return;
      }
      fn(...args);
    }, []);

  /** Garde combinée des boutons OSD : avalement-révélation + garde scrub. */
  const guardButton = useCallback(<T extends unknown[]>(fn: (...args: T) => void) =>
    guardReveal(guardScrub(fn)), [guardReveal, guardScrub]);

  // --- Badge « +30s / −10s » après un skip OSD caché (double-clic ←/→) :
  // ni trickplay, ni OSD — juste le delta, façon Netflix. OSD visible
  // (boutons ±10/30) : la seekbar montre déjà le saut, pas de badge. ---
  const [skipFlash, setSkipFlash] = useState<{ delta: number; id: number } | null>(null);
  const skipFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (skipFlashTimerRef.current) clearTimeout(skipFlashTimerRef.current); }, []);

  const skipBy = useCallback((delta: number) => {
    const dur = durationRef.current || 0;
    const target = currentTimeRef.current + delta;
    const clamped = Math.max(0, dur > 0 ? Math.min(target, dur) : target);
    currentTimeRef.current = clamped;
    onSeekRef.current(clamped);
    if (!overlayVisibleRef.current) {
      setSkipFlash({ delta, id: Date.now() });
      if (skipFlashTimerRef.current) clearTimeout(skipFlashTimerRef.current);
      skipFlashTimerRef.current = setTimeout(() => setSkipFlash(null), SKIP_BADGE_MS);
    }
  }, []);

  // --- D-pad ←/→ (OSD caché) : simple appui = OSD, double-clic = ±30/−10,
  // maintien ~1s = avance/recul rapide (scrub). OSD visible : navigation. ---
  const tapRef = useRef<{ dir: "forward" | "backward"; ts: number; timer: ReturnType<typeof setTimeout> | null } | null>(null);
  const scrubHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTapState = useCallback(() => {
    if (tapRef.current?.timer) clearTimeout(tapRef.current.timer);
    tapRef.current = null;
  }, []);

  // Avance continue pendant le MAINTIEN ←/→ (le système n'émet pas les
  // répétitions) : tick JS démarré à l'entrée en scrub, stoppé au key-up.
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
    // Panneau ouvert (paramètres, épisodes) : le D-pad appartient au panneau
    if (panelOpenRef.current) return;
    skipAnyPressRef.current = true;
    if (scrubbingRef.current) {
      // Hold en cours (ou son key-up résiduel) : l'avance est pilotée par le
      // tick JS — les events directionnels seraient des doublons parasites.
      if (holdScrubIntervalRef.current || Date.now() - holdScrubStoppedAtRef.current < 400) return;
      moveScrub(dir);
      return;
    }
    if (overlayVisibleRef.current) {
      // OSD affiché → laisser le focus engine naviguer entre les boutons
      showOverlay();
      return;
    }

    const now = Date.now();
    const tap = tapRef.current;
    if (tap && tap.dir === dir) {
      const gap = now - tap.ts;
      if (gap < DOUBLE_TAP_MIN_MS) {
        // Auto-repeat système (maintien) — le scrub est armé par le long-press
        tap.ts = now;
        return;
      }
      if (gap < DOUBLE_TAP_MAX_MS) {
        // Double-clic : skip direct +30s / −10s — badge seul, l'OSD reste caché
        clearTapState();
        skipBy(dir === "forward" ? 30 : -10);
        return;
      }
    }
    // 1er appui : OSD différé le temps de la fenêtre du double-clic
    clearTapState();
    tapRef.current = {
      dir, ts: now,
      timer: setTimeout(() => { tapRef.current = null; showOverlay(); }, DOUBLE_TAP_MAX_MS),
    };
  }, [moveScrub, showOverlay, skipBy, clearTapState]);

  // Long-press ←/→ (signal système ~300ms) : armer l'avance/recul rapide après
  // un délai supplémentaire — total ≈ 1s de maintien avant déclenchement.
  const handleLongDirection = useCallback((dir: "forward" | "backward") => {
    if (panelOpenRef.current || scrubbingRef.current) return;
    if (overlayVisibleRef.current) return;
    clearTapState();
    if (scrubHoldTimerRef.current) clearTimeout(scrubHoldTimerRef.current);
    scrubHoldTimerRef.current = setTimeout(() => {
      scrubHoldTimerRef.current = null;
      startScrubbing(dir);
      // Tant que la touche est maintenue, le curseur avance tout seul
      // (accélération par paliers via moveScrub) — arrêt au key-up.
      stopHoldScrub();
      holdScrubIntervalRef.current = setInterval(() => moveScrub(dir), HOLD_SCRUB_TICK_MS);
    }, SCRUB_HOLD_EXTRA_MS);
  }, [startScrubbing, clearTapState, stopHoldScrub, moveScrub]);

  const cancelScrubHold = useCallback(() => {
    if (scrubHoldTimerRef.current) { clearTimeout(scrubHoldTimerRef.current); scrubHoldTimerRef.current = null; }
  }, []);
  useEffect(() => () => cancelScrubHold(), [cancelScrubHold]);

  // Touches rewind/fast-forward dédiées : scrub direct, même OSD visible
  const handleMediaSeekKey = useCallback((dir: "forward" | "backward") => {
    if (panelOpenRef.current) return;
    skipAnyPressRef.current = true;
    if (scrubbingRef.current) { moveScrub(dir); return; }
    startScrubbing(dir);
  }, [moveScrub, startScrubbing]);

  // --- Skip buttons (overlay transport controls) ---
  const handleSkipForward = useCallback(() => skipBy(30), [skipBy]);
  const handleSkipBack = useCallback(() => skipBy(-10), [skipBy]);

  // --- TV Remote binding ---
  useTVRemote({
    onBack: () => {
      if (scrubbingRef.current) { cancelScrub(); return; }
      onBack();
    },
    onPlayPause: () => {
      if (panelOpenRef.current) return;
      if (scrubbingRef.current) { confirmScrub(); return; }
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
    onLeft: () => handleDpadDirection("backward"),
    onRight: () => handleDpadDirection("forward"),
    onLongLeft: () => handleLongDirection("backward"),
    onLongRight: () => handleLongDirection("forward"),
    onRewind: () => handleMediaSeekKey("backward"),
    onFastForward: () => handleMediaSeekKey("forward"),
    onKeyUp: (eventType) => {
      cancelScrubHold();
      stopHoldScrub();
      if (holdRef.current) endHold();
      // Fin réelle du hold OK : désarmer l'avalement après une courte grâce
      // (absorbe l'incertitude d'ordre onPress ↔ onKeyUp).
      if (eventType === "select" || eventType === "playPause") {
        if (swallowTimerRef.current) clearTimeout(swallowTimerRef.current);
        swallowTimerRef.current = setTimeout(() => {
          swallowButtonPressRef.current = false;
          swallowTimerRef.current = null;
        }, KEYUP_GRACE_MS);
      }
    },
    onDown: () => { if (!scrubbingRef.current && !panelOpenRef.current) showOverlay(); },
    onUp: () => { if (!scrubbingRef.current && !panelOpenRef.current) showOverlay(); },
    onAnyPress: () => {
      if (skipAnyPressRef.current) { skipAnyPressRef.current = false; return; }
      if (scrubbingRef.current || panelOpenRef.current) return;
      showOverlay();
    },
  });

  return {
    currentTimeRef,
    overlayVisible,
    showOverlay,
    speedLabel,
    scrubbing,
    scrubPosition,
    skipFlash,
    confirmScrub,
    cancelScrub,
    guardScrub,
    guardButton,
    handleSkipForward,
    handleSkipBack,
  };
}
