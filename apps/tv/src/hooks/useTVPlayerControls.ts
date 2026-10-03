import { useState, useRef, useCallback, useEffect } from "react";
import { useTVRemote } from "../components/focus/useTVRemote";
import { jumpSecondsOf, type TouchMode } from "@tentacle-tv/tv-core";
import { useScrubGestures } from "./useScrubGestures";
import { useScrubController } from "./useScrubController";
import { useSkipFlash } from "./useSkipFlash";

const OVERLAY_HIDE_MS = 5000;
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
/** Un toucher du pavé qui suit un appui de si près l'ACCOMPAGNE (le pouce
 *  frôle la surface en cliquant le bord de l'anneau) : ce n'est pas un geste. */
const TOUCH_AFTER_PRESS_MS = 600;

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
 * Contrôles télécommande du lecteur — le modèle du lecteur d'Apple, que
 * Netflix a longtemps été sur Apple TV. Deux gestes distincts :
 *
 * - le SAUT, instantané : habillage caché, un APPUI ←/→ saute de son sens
 *   (+30 s, −10 s : `seekTuning.ts`), exactement comme les boutons de saut de
 *   l'habillage ; la lecture continue (ou reste en pause), les appuis
 *   rapprochés se cumulent, le badge le dit (`skipFlash`) ;
 * - l'AVANCE RAPIDE, le défilement : bouton ⏩, MAINTIEN ←/→ (curseur fantôme
 *   qui accélère), glisser au pavé. Seek seulement à la validation : OK lit
 *   aussitôt depuis la position visée, Retour revient où l'on était ; entré
 *   en lecture, la lecture repart seule à la cible 5 s après le dernier geste
 *   (`scrubCountdown.ts`) ; en pause, rien ne part seul. Un appui ←/→ y
 *   déplace la cible du saut de son sens.
 * Habillage visible, ←/→ naviguent. Orchestrateur : visibilité de l'OSD,
 * badge des sauts ; délègue tout le scrub à useScrubController (source unique
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
  /** Le dernier appui ou relâchement d'une touche (cf. `TOUCH_AFTER_PRESS_MS`). */
  const lastPressAtRef = useRef(0);

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

  const revealOverlay = useCallback(() => {
    lastShowOverlayRef.current = Date.now();
    setOverlayVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (!pausedRef.current && !panelOpen) {
      hideTimerRef.current = setTimeout(() => setOverlayVisible(false), OVERLAY_HIDE_MS);
    }
  }, [panelOpen]);

  /** Masquage immédiat de l'OSD (entrée en scrub) — annule aussi l'auto-hide. */
  const hideOverlay = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    setOverlayVisible(false);
  }, []);

  // --- Le saut instantané, et son badge cumulé (`useSkipFlash`). ---
  const { skipFlash, flash } = useSkipFlash();
  /** La lecture va aussitôt à la base + le saut. La base (`currentTimeRef`)
   *  se cumule : un +30 enchaîné part de la dernière cible, jamais d'une
   *  position pas encore rapportée. En pause, elle y reste. */
  const skipBy = useCallback((delta: number) => {
    const dur = durationRef.current || 0;
    const target = currentTimeRef.current + delta;
    const clamped = Math.max(0, dur > 0 ? Math.min(target, dur) : target);
    currentTimeRef.current = clamped;
    onSeekRef.current(clamped);
    flash(delta);
  }, [currentTimeRef, flash]);
  const skipRef = useRef<(dir: "forward" | "backward") => void>(() => {});
  skipRef.current = (dir) => skipBy(jumpSecondsOf(dir));

  // --- Moteur de scrub (partagé) ---
  const scrub = useScrubController({
    showOverlay: revealOverlay, hideOverlay, currentTimeRef, durationRef, pausedRef, onSeekRef, onScrubPauseRef,
    onSkipRef: skipRef, overlayVisibleRef, panelOpenRef, skipAnyPressRef,
  });
  const { scrubbingRef } = scrub;

  /** L'habillage, rallumé — sauf pendant le défilement : sa vue y est seule.
   *  Un bouton de saut rallume l'habillage APRÈS avoir ouvert le défilement
   *  (les deux écrans) ; sa fin le rallumera (`onExit`). */
  const showOverlay = useCallback(() => {
    if (!scrubbingRef.current) revealOverlay();
  }, [revealOverlay, scrubbingRef]);

  // Ré-affiche l'OSD aux transitions play/pause — SAUF celle provoquée par le
  // scrub lui-même (startScrubbing met en pause juste après avoir masqué l'OSD).
  useEffect(() => {
    if (!scrubbingRef.current) showOverlay();
    return () => { if (hideTimerRef.current) clearTimeout(hideTimerRef.current); };
  }, [paused, showOverlay, scrubbingRef]);

  /** Garde pour les boutons OSD : en scrub, OK valide le scrub au lieu d'agir.
   *  Absorbe aussi le press JUMEAU du OK qui vient de terminer le scrub (le
   *  « select » global et le press du bouton focusé partent du même key-up). */
  const guardScrub = useCallback(<T extends unknown[]>(fn: (...args: T) => void) =>
    (...args: T) => {
      if (scrubbingRef.current) { scrub.confirmScrub(); return; }
      if (Date.now() - scrub.scrubEndedAtRef.current < SCRUB_TWIN_PRESS_MS) return;
      fn(...args);
    }, [scrub, scrubbingRef]);

  // Le bouton ⏩ ouvre le défilement sous un appui sur OK : le « select »
  // jumeau de cet appui ne doit pas le valider aussitôt.
  const { jump, startScrubbing, scrubStartedAtRef } = scrub;
  const pressEntry = useCallback(() => { scrubStartedAtRef.current = Date.now(); }, [scrubStartedAtRef]);
  // Les boutons de saut de l'habillage font EXACTEMENT ce que font les
  // flèches : un saut instantané — ou, défilement ouvert, la cible qui bouge.
  const skipOrJump = useCallback((dir: "forward" | "backward") => {
    if (scrubbingRef.current) jump(dir);
    else skipBy(jumpSecondsOf(dir));
  }, [scrubbingRef, jump, skipBy]);
  const handleSkipForward = useCallback(() => skipOrJump("forward"), [skipOrJump]);
  const handleSkipBack = useCallback(() => skipOrJump("backward"), [skipOrJump]);
  /** Bouton ⏩ de l'OSD : appui simple → mode scrub (curseur fantôme), et le
   *  décompte part (en lecture). En scrub, guardScrub transforme le même
   *  appui en confirmation. */
  const enterScrub = useCallback(() => { pressEntry(); startScrubbing(); }, [pressEntry, startScrubbing]);

  /** Un simple toucher du pavé réveille l'habillage, comme le lecteur d'Apple —
   *  sauf celui qui accompagne un clic (le saut d'un appui ne rallume rien). En
   *  défilement, c'est un geste : le décompte repart de zéro. */
  const { endDrag } = scrub;
  const wakeFromTouch = useCallback(() => {
    if (scrubbingRef.current) { endDrag(); return; }
    if (Date.now() - lastPressAtRef.current < TOUCH_AFTER_PRESS_MS) return;
    showOverlay();
  }, [showOverlay, scrubbingRef, endDrag]);

  /** Le régime d'un glisser qui commence : habillage caché, il attend un
   *  contact tenu avant de défiler (`scrubTouchTuning.ts`). L'habillage tel
   *  qu'il est À L'ÉCRAN : la pause l'allume (`showOverlay`), mais Retour peut
   *  le masquer en pause aussi (pile du Retour d'Apple TV) — la pause seule
   *  ne compte pas pour affichée. */
  const readTouchMode = useCallback((): TouchMode => {
    if (scrubbingRef.current) return "open";
    return overlayVisibleRef.current ? "shown" : "hidden";
  }, [scrubbingRef]);

  // --- Défilement au pavé tactile (Apple TV ; rien sur Android TV, sans pavé) :
  //     le doigt emporte le curseur fantôme, partout où la vidéo est le sujet —
  //     en lecture comme en pause, habillage visible ou non. Glisser = défiler,
  //     comme le lecteur d'Apple ; les boutons de l'habillage se parcourent au
  //     clic. Les panneaux (épisodes, pistes, fin) gardent le pavé pour leurs
  //     listes. ---
  useScrubGestures({
    enabled: !panelOpen,
    readTouchMode,
    onTouchStart: scrub.touchStart,
    onStartScrub: scrub.startDrag,
    onNudgeScrub: scrub.nudgeScrub,
    // Lever du doigt : le scrub reste ouvert — OK/▶︎❙❙ valide le seek, Back
    // annule ; sans geste, la lecture repart à la cible au bout du décompte
    // (entré en lecture), sinon l'inactivité annule SANS seek.
    onEndScrub: scrub.endDrag,
    onWake: wakeFromTouch,
    durationRef,   // durée inconnue : le glisser ne défile pas
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
      if (scrubbingRef.current) {
        // Écho pendant le maintien d'une touche media FF/RW → ignorer.
        if (Date.now() - scrub.lastMediaKeyAtRef.current < MEDIA_KEY_ECHO_MS) return;
        // Jumeau du OK qui vient d'OUVRIR le scrub (un bouton) → ignorer.
        if (Date.now() - scrub.scrubStartedAtRef.current < SCRUB_TWIN_PRESS_MS) return;
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
    onKeyUp: () => { lastPressAtRef.current = Date.now(); scrub.onHoldRelease(); },
    onDown: () => { if (!scrubbingRef.current && !panelOpenRef.current) showOverlay(); },
    onUp: () => { if (!scrubbingRef.current && !panelOpenRef.current) showOverlay(); },
    // OK (SELECT) pendant le scrub : valide le seek où que soit le focus — le scrub
    // au raccourci ne déplace plus le focus sur play/pause, donc OK doit confirmer
    // globalement (le bouton play/pause focalisé confirme aussi via son onPress).
    onSelect: () => {
      if (panelOpenRef.current) return;
      if (scrubbingRef.current) {
        // Écho pendant le maintien d'une touche media FF/RW → ignorer.
        if (Date.now() - scrub.lastMediaKeyAtRef.current < MEDIA_KEY_ECHO_MS) return;
        // Jumeau du OK qui vient d'OUVRIR le scrub (un bouton) → ignorer.
        if (Date.now() - scrub.scrubStartedAtRef.current < SCRUB_TWIN_PRESS_MS) return;
        scrub.confirmScrub();
      }
    },
    onAnyPress: () => {
      lastPressAtRef.current = Date.now();
      if (skipAnyPressRef.current) { skipAnyPressRef.current = false; return; }
      if (scrubbingRef.current || panelOpenRef.current) return;
      showOverlay();
    },
  });

  return {
    currentTimeRef,
    overlayVisible,
    showOverlay,
    hideOverlay,
    speedLabel: scrub.speedLabel,
    scrubbing: scrub.scrubbing,
    scrubPosition: scrub.scrubPosition,
    /** Quand le défilement se fermera seul, et pour quoi (`scrubCountdown.ts`). */
    scrubCountdown: scrub.scrubCountdown,
    skipFlash,
    confirmScrub: scrub.confirmScrub,
    cancelScrub: scrub.cancelScrub,
    guardScrub,
    handleSkipForward,
    handleSkipBack,
    enterScrub,
  };
}
