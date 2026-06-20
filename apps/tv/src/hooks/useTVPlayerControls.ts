import { useState, useRef, useCallback, useEffect } from "react";
import { useTVRemote } from "../components/focus/useTVRemote";
import { useScrubGestures } from "./useScrubGestures";
import { useScrubController } from "./useScrubController";

const OVERLAY_HIDE_MS = 5000;
/** Durée d'affichage du badge « +30s / −10s » après un skip OSD caché */
const SKIP_BADGE_MS = 1000;

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

/**
 * Contrôles télécommande du lecteur — modèle « Netflix » : ←/→ ne seekent jamais
 * la lecture (OSD visible → navigation ; OSD caché/maintien → SCRUB avec curseur
 * fantôme, seek seulement à la confirmation). Orchestrateur : visibilité de
 * l'OSD + skip ±10/30, délègue tout le scrub à useScrubController (source unique
 * partagée Android/tvOS) et branche les entrées (télécommande + gestes tvOS).
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
  /** Évite que onAnyPress ré-affiche l'OSD sur les events ←/→. */
  const skipAnyPressRef = useRef(false);

  // --- Overlay visibility ---
  const [overlayVisible, setOverlayVisible] = useState(true);
  const overlayVisibleRef = useRef(true);
  overlayVisibleRef.current = overlayVisible;
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Timestamp of last showOverlay call — used to debounce playPause events */
  const lastShowOverlayRef = useRef(0);

  const showOverlay = useCallback(() => {
    lastShowOverlayRef.current = Date.now();
    setOverlayVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (!paused && !panelOpen) {
      hideTimerRef.current = setTimeout(() => setOverlayVisible(false), OVERLAY_HIDE_MS);
    }
  }, [paused, panelOpen]);

  useEffect(() => {
    showOverlay();
    return () => { if (hideTimerRef.current) clearTimeout(hideTimerRef.current); };
  }, [paused, showOverlay]);

  // --- Moteur de scrub (partagé) ---
  const scrub = useScrubController({
    showOverlay, currentTimeRef, durationRef, onSeekRef, onScrubPauseRef,
    overlayVisibleRef, panelOpenRef, skipAnyPressRef,
  });
  const { scrubbingRef } = scrub;

  /** Garde pour les boutons OSD : en scrub, OK valide le scrub au lieu d'agir. */
  const guardScrub = useCallback(<T extends unknown[]>(fn: (...args: T) => void) =>
    (...args: T) => {
      if (scrubbingRef.current) { scrub.confirmScrub(); return; }
      fn(...args);
    }, [scrub, scrubbingRef]);

  // --- Badge « +30s / −10s » après un skip OSD caché : juste le delta, façon
  // Netflix. OSD visible (boutons ±10/30) : la seekbar montre déjà le saut. ---
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

  const handleSkipForward = useCallback(() => skipBy(30), [skipBy]);
  const handleSkipBack = useCallback(() => skipBy(-10), [skipBy]);

  // --- Scrub gestuel (tvOS) : la Siri Remote n'a ni longLeft/longRight ni
  //     rewind/fastForward → on alimente le MÊME mécanisme de scrub depuis les
  //     gestes pan. No-op sur Android. Pan actif seulement quand on peut
  //     scrubber : OSD caché ou scrub en cours (sinon masquerait la nav focus). ---
  useScrubGestures({
    enabled: !panelOpen && (scrub.scrubbing || !overlayVisible),
    onStartScrub: scrub.startScrubbing,
    onNudgeScrub: scrub.nudgeScrub,
    onSpeedLabel: scrub.setSpeedLabel,
    onEndScrub: scrub.endHold,
    onWake: showOverlay,
  });

  // --- TV Remote binding ---
  useTVRemote({
    onBack: () => {
      // Panneau ouvert (réglages/épisodes) : le « back » appartient au panneau,
      // qui se referme via son propre useTVRemote. Sur tvOS, useTVEventHandler
      // est global (pas LIFO comme Android) → sans cette garde, le handler du
      // lecteur tire AUSSI et quitte la vidéo.
      if (panelOpenRef.current) return;
      if (scrubbingRef.current) { scrub.cancelScrub(); return; }
      onBack();
    },
    onPlayPause: () => {
      if (panelOpenRef.current) return;
      if (scrubbingRef.current) { scrub.confirmScrub(); return; }
      // Bouton matériel dédié ▶︎❙❙ (eventType "playPause", routé séparément de
      // "select" par useTVRemote) : TOUJOURS toggler + montrer l'OSD, même OSD
      // caché. Le débounce anti double-event Shield (select+playPause) reste sur
      // le chemin select/onAnyPress (idempotent), pas ici.
      onPlayPause();
      showOverlay();
    },
    onLeft: () => scrub.handleDpadDirection("backward"),
    onRight: () => scrub.handleDpadDirection("forward"),
    onLongLeft: () => scrub.handleLongDirection("backward"),
    onLongRight: () => scrub.handleLongDirection("forward"),
    onRewind: () => scrub.handleMediaSeekKey("backward"),
    onFastForward: () => scrub.handleMediaSeekKey("forward"),
    onKeyUp: scrub.onHoldRelease,
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
    speedLabel: scrub.speedLabel,
    scrubbing: scrub.scrubbing,
    scrubPosition: scrub.scrubPosition,
    skipFlash,
    confirmScrub: scrub.confirmScrub,
    cancelScrub: scrub.cancelScrub,
    guardScrub,
    handleSkipForward,
    handleSkipBack,
  };
}
