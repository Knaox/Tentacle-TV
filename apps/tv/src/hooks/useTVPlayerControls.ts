import { useState, useRef, useCallback, useEffect } from "react";
import { useTVRemote } from "../components/focus/useTVRemote";
import { osdFocusedKeyRef } from "../components/player/focus/osdFocusBus";
import { useScrubGestures } from "./useScrubGestures";
import { useScrubController } from "./useScrubController";
import { BUTTON_SEEK_BASE } from "./scrubAcceleration";

const OVERLAY_HIDE_MS = 5000;
/** Fenêtre de cumul des sauts consécutifs (= durée d'affichage du badge). Tant
 *  qu'on ré-appuie dans cette fenêtre et dans le MÊME sens, le badge cumule
 *  (+30 → +60 → +90 ; −10 → −20 → −30). */
const SKIP_BADGE_MS = 1500;
/** Un OK émet l'event TV global « select » ET le press du Pressable focusé
 *  (même key-up, ordre indéterminé). Quand le premier des deux confirme le
 *  scrub, le jumeau arrivé ensuite voyait `scrubbing=false` et EXÉCUTAIT
 *  l'action du bouton focusé (Retour = sortie de la vidéo). On absorbe tout
 *  press OSD dans cette fenêtre après la fin d'un scrub. */
const SCRUB_TWIN_PRESS_MS = 400;
/** Pendant le MAINTIEN d'une touche media FF/RW, certaines télécommandes
 *  intercalent des échos select/playPause entre les répétitions (cf. double
 *  event Shield select+playPause) → ils confirmaient le scrub en plein
 *  maintien (« ça clique tout seul sur OK »). Un vrai OK de confirmation
 *  n'arrive qu'après relâchement, donc au-delà de cette fenêtre. */
const MEDIA_KEY_ECHO_MS = 300;

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
  /** Base position/skips PARTAGÉE avec les hooks de seek (possédée par PlayerScreen) :
   *  les commits de seek la synchronisent directement — un +30 enchaîné part toujours
   *  de la dernière cible, jamais d'un progress périmé. Défaut : ref interne. */
  currentTimeRef?: React.MutableRefObject<number>;
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
  panelOpen = false, currentTimeRef: externalTimeRef,
}: TVPlayerControlsOptions) {
  const internalTimeRef = useRef(0);
  const currentTimeRef = externalTimeRef ?? internalTimeRef;
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
  // État pause LU à l'armement de l'auto-hide. La closure `paused` de showOverlay
  // était périmée au retour de scrub (confirmScrub appelle showOverlay juste après
  // avoir demandé la reprise, avant le re-render) → timer jamais armé → OSD bloqué
  // à l'écran. Un ref synchronisé à chaque render le corrige : l'effet [paused]
  // ré-appelle showOverlay au passage paused→false et arme alors le timer.
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  const showOverlay = useCallback(() => {
    lastShowOverlayRef.current = Date.now();
    setOverlayVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (!pausedRef.current && !panelOpen) {
      hideTimerRef.current = setTimeout(() => setOverlayVisible(false), OVERLAY_HIDE_MS);
    }
  }, [panelOpen]);

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

  /** Garde pour les boutons OSD : en scrub, OK valide le scrub au lieu d'agir.
   *  Absorbe aussi le press JUMEAU du OK qui vient de terminer le scrub (le
   *  « select » global et le press du bouton focusé partent du même key-up). */
  const guardScrub = useCallback(<T extends unknown[]>(fn: (...args: T) => void) =>
    (...args: T) => {
      if (scrubbingRef.current) { scrub.confirmScrub(); return; }
      if (Date.now() - scrub.scrubEndedAtRef.current < SCRUB_TWIN_PRESS_MS) return;
      fn(...args);
    }, [scrub, scrubbingRef]);

  // --- Badge « +30s / −10s » après un skip OSD caché : juste le delta, façon
  // Netflix. OSD visible (boutons ±10/30) : la seekbar montre déjà le saut. ---
  const [skipFlash, setSkipFlash] = useState<{ delta: number; id: number } | null>(null);
  const skipFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Cumul des sauts consécutifs de même sens dans la fenêtre SKIP_BADGE_MS.
  const skipAccumRef = useRef(0);
  useEffect(() => () => { if (skipFlashTimerRef.current) clearTimeout(skipFlashTimerRef.current); }, []);

  const skipBy = useCallback((delta: number) => {
    const dur = durationRef.current || 0;
    const target = currentTimeRef.current + delta;
    const clamped = Math.max(0, dur > 0 ? Math.min(target, dur) : target);
    currentTimeRef.current = clamped;
    onSeekRef.current(clamped);

    // Badge cumulatif : appuis répétés dans le MÊME sens → +30/+60/+90 (ou
    // −10/−20…). Un saut en sens opposé (ou hors fenêtre) repart du delta seul.
    // Le seek lui-même reste incrémental (currentTimeRef se cumule). Affiché
    // que l'OSD soit visible (clic bouton) ou caché (raccourci télécommande).
    const sameDir = skipAccumRef.current !== 0 && Math.sign(delta) === Math.sign(skipAccumRef.current);
    skipAccumRef.current = sameDir ? skipAccumRef.current + delta : delta;
    setSkipFlash({ delta: skipAccumRef.current, id: Date.now() });
    if (skipFlashTimerRef.current) clearTimeout(skipFlashTimerRef.current);
    skipFlashTimerRef.current = setTimeout(() => { skipAccumRef.current = 0; setSkipFlash(null); }, SKIP_BADGE_MS);
  }, []);

  const handleSkipForward = useCallback(() => skipBy(30), [skipBy]);
  const handleSkipBack = useCallback(() => skipBy(-10), [skipBy]);
  /** Tap court sur ⏪/⏩ de l'OSD (Android) : petit saut immédiat, sans fantôme
   *  ni confirmation. Pendant un scrub préparé, guardScrub confirme à la place. */
  const handleNudgeForward = useCallback(() => skipBy(BUTTON_SEEK_BASE), [skipBy]);
  const handleNudgeBack = useCallback(() => skipBy(-BUTTON_SEEK_BASE), [skipBy]);

  // --- Scrub gestuel (tvOS) : la Siri Remote n'a ni longLeft/longRight ni
  //     rewind/fastForward → on alimente le MÊME mécanisme de scrub depuis les
  //     gestes pan. No-op sur Android. Pan actif seulement quand on peut
  //     scrubber : OSD caché ou scrub en cours (sinon masquerait la nav focus). ---
  useScrubGestures({
    enabled: !panelOpen && (scrub.scrubbing || !overlayVisible),
    onStartScrub: scrub.startScrubbing,
    onNudgeScrub: scrub.nudgeScrub,
    onSpeedLabel: scrub.setSpeedLabel,
    // Lever du doigt : le scrub reste ouvert — OK/▶︎❙❙ valide le seek, Back
    // annule, l'inactivité annule seule SANS seek (anti-seek accidentel).
    onEndScrub: scrub.endShuttleGesture,
    onWake: showOverlay,
    durationRef,   // vitesse de scrub adaptée à la durée de la vidéo
  });

  // --- TV Remote binding ---
  useTVRemote({
    debugTag: "PLAYER", // TODO(diag): À RETIRER

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
      // Maintien d'un bouton OSD FF/RW : seul le relâchement du bouton
      // (onPressOut → stopButtonSeek) termine le scrub — un playPause écho ne
      // doit pas le confirmer en plein maintien.
      if (scrub.scrubViaButtonRef.current) return;
      if (scrubbingRef.current) {
        // Écho pendant le maintien d'une touche media FF/RW → ignorer.
        if (Date.now() - scrub.lastMediaKeyAtRef.current < MEDIA_KEY_ECHO_MS) return;
        scrub.confirmScrub();
        return;
      }
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
    // OK (SELECT) pendant le scrub : valide le seek où que soit le focus — le scrub
    // au raccourci ne déplace plus le focus sur play/pause, donc OK doit confirmer
    // globalement (le bouton play/pause focalisé confirme aussi via son onPress).
    onSelect: () => {
      if (panelOpenRef.current) return;
      // Focus sur un bouton FF/RW : OK relève du moteur de seek (tap/maintien,
      // routé par le canal natif tntCenterHold) — jamais d'une confirmation.
      const k = osdFocusedKeyRef.current;
      if (k === "fastforward" || k === "rewind") return;
      // Maintien d'un bouton OSD FF/RW : les échos « select » du maintien ne
      // confirment pas — c'est le relâchement du bouton qui termine le scrub.
      if (scrub.scrubViaButtonRef.current) return;
      if (scrubbingRef.current) {
        // Écho pendant le maintien d'une touche media FF/RW → ignorer.
        if (Date.now() - scrub.lastMediaKeyAtRef.current < MEDIA_KEY_ECHO_MS) return;
        scrub.confirmScrub();
      }
    },
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
    handleNudgeForward,
    handleNudgeBack,
    buttonSeekStart: scrub.startButtonSeek,
    buttonSeekStop: scrub.stopButtonSeek,
    scrubViaButton: scrub.scrubViaButton,
  };
}
