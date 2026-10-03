import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { createScrubMachine, jumpSecondsOf, reportingActivity } from "@tentacle-tv/tv-core";
import { backgroundHoldsFocus } from "../components/player/focus/osdFocusBus";
import { SCRUB_INPUT } from "./scrubInput";
import { useScrubCountdown } from "./useScrubCountdown";
import { useScrubHoldMotor } from "./useScrubHoldMotor";

type Dir = "forward" | "backward";
type Ref<T> = MutableRefObject<T>;

const signOf = (dir: Dir): 1 | -1 => (dir === "forward" ? 1 : -1);

/** Une reprise automatique sur une cible inchangée n'est qu'une annulation :
 *  aucun seek pour revenir au même endroit. */
const UNMOVED_SECONDS = 1;

interface ScrubControllerArgs {
  showOverlay: () => void;
  /** Masque l'OSD à l'ENTRÉE en scrub : la vue du défilement est seule à
   *  l'écran, et le fond reprend le focus. */
  hideOverlay: () => void;
  currentTimeRef: Ref<number>;
  durationRef: Ref<number>;
  /** La lecture est-elle en pause ? Lu à l'entrée : annuler rend cet état. */
  pausedRef: Ref<boolean>;
  onSeekRef: Ref<(seconds: number) => void>;
  onScrubPauseRef: Ref<(paused: boolean) => void>;
  /** Un SAUT INSTANTANÉ hors défilement (appui ←/→ habillage caché) : la
   *  lecture va aussitôt au saut de son sens, sans ouvrir le défilement. */
  onSkipRef: Ref<(dir: Dir) => void>;
  overlayVisibleRef: Ref<boolean>;
  panelOpenRef: Ref<boolean>;
  /** Évite que onAnyPress ré-affiche l'OSD sur les events ←/→. */
  skipAnyPressRef: Ref<boolean>;
}

/**
 * L'ADAPTATEUR du scrub — la MACHINE (curseur fantôme, paliers, aucun seek
 * avant confirmation, état de lecture rendu à l'annulation) vit dans
 * `createScrubMachine` (tv-core), la même que la LG, ici SANS son abandon sur
 * inactivité (`idleCancelMs: null`) : le décompte ferme le défilement.
 * Ne restent ici que :
 *
 *  - le miroir React (états `scrubbing`/`scrubPosition`/`speedLabel`) ;
 *  - l'orchestration de l'OSD (masqué à l'entrée, réaffiché à la sortie) ;
 *  - l'absorption des événements JUMEAUX (un OK émet à la fois l'event TV
 *    global et le press du bouton focusé) et des échos de touches média ;
 *  - les gestes, les mêmes sur toutes les plateformes : hors défilement, un
 *    APPUI ←/→ SAUTE aussitôt (+30 s, −10 s, `seekTuning.ts`), la lecture
 *    continue (`onSkipRef`) ; un MAINTIEN ouvre le défilement et défile en
 *    accélérant ; défilement ouvert, un appui DÉPLACE LA CIBLE du saut de
 *    son sens (`jump`) ; la couture `SCRUB_INPUT` dit seulement comment la
 *    plateforme les émet ;
 *  - la TRAPPE du curseur — voir `nudgeScrub` ;
 *  - le DÉCOMPTE (`scrubCountdown.ts`), une règle pour toutes les façons
 *    d'ouvrir le défilement (⏩, maintien, pavé, touches média) : entré en
 *    lecture, il reprend à la position visée 5 s après le dernier geste ;
 *    entré en pause, la cible attend OK ou Retour.
 *
 * **La trappe.** Le glisser du pavé avance par deltas CONTINUS, l'appui d'un
 * saut fixe : la machine ne connaît que ses pas proportionnels. La
 * position AFFICHÉE fait donc foi : les pas de la machine s'y appliquent en
 * DELTAS, la trappe directement (en relançant le décompte, `touch`), et la
 * confirmation seek TOUJOURS sur l'affichage.
 */
export function useScrubController({
  showOverlay, hideOverlay, currentTimeRef, durationRef, pausedRef, onSeekRef, onScrubPauseRef, onSkipRef,
  overlayVisibleRef, panelOpenRef, skipAnyPressRef,
}: ScrubControllerArgs) {
  const [scrubbing, setScrubbing] = useState(false);
  const scrubbingRef = useRef(false);
  const [scrubPosition, setScrubPosition] = useState(0);
  const scrubPositionRef = useRef(0);
  const [speedLabel, setSpeedLabel] = useState<string | null>(null);

  // Fin du dernier scrub (confirm OU cancel) : absorbe le press jumeau d'un OK.
  const scrubEndedAtRef = useRef(0);
  // Entrée par un bouton de l'habillage, sous un appui sur OK : absorbe le
  // « select » jumeau de cet appui. Posée par l'appelant — une flèche ouvre
  // aussi le défilement, et l'OK qui la suit de près valide, lui.
  const scrubStartedAtRef = useRef(0);
  // Dernier event touche media FF/RW : absorbe les échos select/playPause.
  const lastMediaKeyAtRef = useRef(0);

  // Arrêt des moteurs de maintien (rempli après useScrubHoldMotor).
  const stopMotorsRef = useRef<() => void>(() => {});

  // Dernière position CONNUE de la machine — sert à appliquer ses pas en
  // deltas sur l'affichage (trappe).
  const machineLastRef = useRef(0);
  // L'origine du défilement, et l'état de lecture d'alors — lu par la
  // machine AVANT sa mise en pause (un rendu synchrone le changerait).
  const originRef = useRef(0);
  const enteredPausedRef = useRef(false);
  const resumeRef = useRef<() => void>(() => {});
  const { countdown, countdownState } = useScrubCountdown(() => resumeRef.current());

  const clampDisplay = useCallback((value: number) => {
    const duration = durationRef.current || 0;
    if (!(duration > 0)) return Math.max(0, value);
    return Math.min(Math.max(0, value), duration);
  }, [durationRef]);

  const setDisplay = useCallback((value: number) => {
    scrubPositionRef.current = value;
    setScrubPosition(value);
  }, []);

  const machine = useMemo(() => reportingActivity(createScrubMachine({
    readPosition: () => currentTimeRef.current,
    readDuration: () => durationRef.current || 0,
    readPaused: () => { enteredPausedRef.current = pausedRef.current; return pausedRef.current; },
    // Aucun abandon : entré en lecture, le décompte reprend à la cible ;
    // entré en pause, la cible attend OK ou Retour.
    idleCancelMs: null,
    onEnter: (position) => {
      scrubbingRef.current = true;
      setScrubbing(true);
      machineLastRef.current = position;
      originRef.current = position;
      setDisplay(position);
      countdown.begin(enteredPausedRef.current);
      // L'OSD se MASQUE pendant le scrub : la vue du défilement est seule, le
      // fond redevient focusable et capte OK/←/→ sans navigation.
      hideOverlay();
    },
    onChange: (position) => {
      const delta = position - machineLastRef.current;
      machineLastRef.current = position;
      setDisplay(clampDisplay(scrubPositionRef.current + delta));
    },
    onPause: (pause) => onScrubPauseRef.current(pause),
    onSeek: () => {
      // La position AFFICHÉE fait foi (elle intègre la trappe). Base des
      // sauts synchronisée AVANT le seek : un saut aussitôt après la
      // confirmation ne doit pas repartir de la position pré-scrub.
      currentTimeRef.current = scrubPositionRef.current;
      onSeekRef.current(scrubPositionRef.current);
    },
    onExit: () => {
      countdown.end();
      stopMotorsRef.current();
      scrubEndedAtRef.current = Date.now();
      scrubbingRef.current = false;
      setScrubbing(false);
      setSpeedLabel(null);
      showOverlay();
    },
    // Machine unique : toutes les entrées passent par des refs stables.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), countdown), []);
  useEffect(() => () => machine.destroy(), [machine]);

  // La reprise échue (décompte au bout, 5 s après le dernier geste) : lire
  // depuis la cible — ou, cible inchangée, rendre la lecture sans seek.
  resumeRef.current = () => {
    if (__DEV__) console.log("[SCRUB] reprise automatique");
    stopMotorsRef.current();
    if (Math.abs(scrubPositionRef.current - originRef.current) < UNMOVED_SECONDS) machine.cancel();
    else machine.confirm();
  };

  // Avance du curseur hors des pas de la machine (glisser du pavé, appui
  // fin) : delta signé en secondes — la TRAPPE (cf. en-tête).
  const nudgeScrub = useCallback((deltaSeconds: number) => {
    machine.touch();
    setDisplay(clampDisplay(scrubPositionRef.current + deltaSeconds));
  }, [machine, clampDisplay, setDisplay]);

  /** Un pas SEC (appui simple ←/→ ou touche média isolée) : le saut de son
   *  sens, jamais d'accélération — elle est réservée au MAINTIEN (tic du moteur). */
  const stepScrub = useCallback((dir: Dir) => {
    setSpeedLabel(null);
    nudgeScrub(jumpSecondsOf(dir));
  }, [nudgeScrub]);

  const startScrubbing = useCallback((dir?: Dir) => {
    // Déjà en scrub (doigt levé puis reposé, maintien qui reprend) → NE PAS
    // réinitialiser la position fantôme ; on relance juste le décompte.
    if (machine.isActive()) { machine.touch(); return; }
    machine.enter();
    if (dir) stepScrub(dir);
  }, [machine, stepScrub]);

  /** Un tic de MAINTIEN : le moteur fournit le palier (1 par seconde). */
  const tickScrub = useCallback((dir: Dir, tier: number) => {
    machine.step(signOf(dir), tier);
    setSpeedLabel(tier > 1 ? `${dir === "forward" ? ">>" : "<<"}${tier}x` : null);
  }, [machine]);

  const confirmScrub = useCallback(() => {
    if (__DEV__) console.log(`[SCRUB] confirmScrub (scrubbing=${scrubbingRef.current})`);
    stopMotorsRef.current();
    machine.confirm();
  }, [machine]);

  const cancelScrub = useCallback(() => {
    stopMotorsRef.current();
    machine.cancel();
  }, [machine]);

  /** Le doigt se pose (ou repart) sur le pavé, défilement ouvert : la reprise attend. */
  const touchStart = useCallback(() => {
    if (!scrubbingRef.current) return;
    machine.touch();
    countdown.hold();
  }, [machine, countdown]);

  /** Le glisser engage : le défilement s'ouvre (ou reprend sous le doigt) ;
   *  la reprise attend le doigt levé. */
  const startDrag = useCallback(() => {
    startScrubbing();
    countdown.hold();
  }, [startScrubbing, countdown]);

  // Le doigt se lève (ou s'immobilise) : le scrub RESTE ouvert — OK/▶︎❙❙
  // valident, BACK annule ; entré en lecture, le décompte repart en entier.
  const endDrag = useCallback(() => {
    if (!scrubbingRef.current) return;
    setSpeedLabel(null);
    machine.touch();
    countdown.release();
  }, [machine, countdown]);

  /** Un appui (ou un bouton de saut) DÉFILEMENT OUVERT : la cible bouge du
   *  saut de son sens, le décompte repart. Hors défilement, rien : le saut y
   *  est instantané (`onSkipRef`), il n'ouvre jamais l'avance rapide. */
  const jump = useCallback((dir: Dir) => {
    if (machine.isActive()) stepScrub(dir);
  }, [machine, stepScrub]);

  /** Un APPUI ←/→ hors défilement, une fois tranché. Il n'appartient à la
   *  vidéo — un saut instantané — que habillage caché, fond focalisé : sous
   *  la pilule de saut ou une carte, il sert leur focus ; habillage visible,
   *  la navigation. Ailleurs, il (r)allume l'habillage. */
  const tap = useCallback((dir: Dir) => {
    if (panelOpenRef.current || scrubbingRef.current) return;
    if (!overlayVisibleRef.current && backgroundHoldsFocus()) onSkipRef.current(dir);
    else showOverlay();
  }, [panelOpenRef, overlayVisibleRef, onSkipRef, showOverlay]);

  // --- Maintien ←/→ et touches média : l'adaptateur du moteur tv-core. Le
  //     maintien tient la reprise ; son relâchement la relance. ---
  const engage = useCallback(() => { startScrubbing(); countdown.hold(); }, [startScrubbing, countdown]);
  const hold = useScrubHoldMotor({
    scrubbingRef, panelOpenRef, overlayVisibleRef,
    stepScrub, tickScrub, onEngage: engage, onTap: tap,
    onHoldEnd: () => { setSpeedLabel(null); countdown.release(); },
  });
  stopMotorsRef.current = hold.stopAll;

  const handleDpadDirection = useCallback((dir: Dir) => {
    if (panelOpenRef.current) return; // panneau ouvert → D-pad au panneau
    skipAnyPressRef.current = true;
    if (SCRUB_INPUT.holdFromKeyDown) hold.armHoldFromDown(dir);
    if (scrubbingRef.current) {
      // Hold en cours (ou key-up résiduel) : l'avance appartient au tic —
      // les events directionnels seraient des doublons parasites.
      if (hold.isHoldTicking()) return;
      jump(dir);
      return;
    }
    // Un appui que le relâchement tranchera (le down pouvait ouvrir un
    // maintien), ou déjà tranché par la plateforme.
    if (SCRUB_INPUT.tapOnRelease) hold.requestDeferredTap(dir);
    else tap(dir);
  }, [jump, tap, panelOpenRef, skipAnyPressRef, hold]);

  // Touches rewind/fast-forward dédiées : scrub direct, même OSD visible.
  // En scrub, la MACHINE départage appui isolé (pas sec) et cadence de
  // répétition (tic accéléré).
  const handleMediaSeekKey = useCallback((dir: Dir) => {
    if (panelOpenRef.current) return;
    skipAnyPressRef.current = true;
    lastMediaKeyAtRef.current = Date.now();
    if (scrubbingRef.current) { hold.mediaPulse(dir); return; }
    startScrubbing(dir);
  }, [startScrubbing, panelOpenRef, skipAnyPressRef, hold]);

  return {
    scrubbing, scrubPosition, speedLabel, scrubbingRef, scrubCountdown: countdownState,
    scrubEndedAtRef, scrubStartedAtRef, lastMediaKeyAtRef,
    nudgeScrub, setSpeedLabel, startScrubbing, jump, confirmScrub, cancelScrub,
    touchStart, startDrag, endDrag,
    handleDpadDirection,
    handleLongDirection: hold.handleLongDirection,
    onHoldRelease: hold.onHoldRelease,
    handleMediaSeekKey,
  };
}
