import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { createScrubMachine } from "@tentacle-tv/tv-core";
import { backgroundHoldsFocus } from "../components/player/focus/osdFocusBus";
import { reportingActivity, type ScrubCountdownView } from "./scrubCountdown";
import { SCRUB_INPUT } from "./scrubInput";
import { jumpSecondsOf } from "./seekTuning";
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
  /** Un appui simple qui appartient à la vidéo : le saut de son sens. */
  onJumpRef: Ref<(dir: Dir) => void>;
  overlayVisibleRef: Ref<boolean>;
  panelOpenRef: Ref<boolean>;
  /** Évite que onAnyPress ré-affiche l'OSD sur les events ←/→. */
  skipAnyPressRef: Ref<boolean>;
}

/**
 * L'ADAPTATEUR du scrub — la MACHINE (curseur fantôme, paliers, annulation à
 * 7 s d'inactivité, aucun seek avant confirmation, état de lecture rendu à
 * l'annulation) vit dans `createScrubMachine` (tv-core), la même que la LG.
 * Ne restent ici que :
 *
 *  - le miroir React (états `scrubbing`/`scrubPosition`/`speedLabel`) ;
 *  - l'orchestration de l'OSD (masqué à l'entrée, réaffiché à la sortie) ;
 *  - l'absorption des événements JUMEAUX (un OK émet à la fois l'event TV
 *    global et le press du bouton focusé) et des échos de touches média ;
 *  - les gestes, les mêmes sur toutes les plateformes : un APPUI saute (la
 *    lecture habillage caché, le curseur en défilement) du saut de son sens —
 *    +30 s, −10 s (`seekTuning.ts`) —, un MAINTIEN défile en accélérant ;
 *    la couture `SCRUB_INPUT` dit seulement
 *    comment la plateforme les émet ;
 *  - la TRAPPE du curseur — voir `nudgeScrub` ;
 *  - le DÉCOMPTE (`scrubCountdown.ts`) : quand le défilement se fermera seul.
 *    Doigt levé après un glisser au pavé, entré en lecture : la lecture
 *    repart à la position visée au bout de 3 s ; partout ailleurs, l'abandon
 *    de la machine, dit pendant ses dernières secondes. Seul le pavé arme la
 *    reprise : sans pavé (Android TV), rien n'en part.
 *
 * **La trappe.** Le glisser du pavé avance par deltas CONTINUS, l'appui d'un
 * saut fixe : la machine ne connaît que ses pas proportionnels. La
 * position AFFICHÉE fait donc foi : les pas de la machine s'y appliquent en
 * DELTAS, la trappe directement (en repoussant l'abandon, `touch`), et la
 * confirmation seek TOUJOURS sur l'affichage.
 */
export function useScrubController({
  showOverlay, hideOverlay, currentTimeRef, durationRef, pausedRef, onSeekRef, onScrubPauseRef, onJumpRef,
  overlayVisibleRef, panelOpenRef, skipAnyPressRef,
}: ScrubControllerArgs) {
  const [scrubbing, setScrubbing] = useState(false);
  const scrubbingRef = useRef(false);
  const [scrubPosition, setScrubPosition] = useState(0);
  const scrubPositionRef = useRef(0);
  const [speedLabel, setSpeedLabel] = useState<string | null>(null);

  // Fin du dernier scrub (confirm OU cancel) : absorbe le press jumeau d'un OK.
  const scrubEndedAtRef = useRef(0);
  // Entrée réelle en scrub : absorbe le « select » jumeau du bouton ⏩.
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
    onEnter: (position) => {
      scrubStartedAtRef.current = Date.now();
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

  // La reprise échue (doigt levé, décompte au bout) : lire depuis la cible —
  // ou, cible inchangée, rendre la lecture sans seek.
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
    // réinitialiser la position fantôme ; on repousse juste l'annulation.
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
   *  entré en lecture, il repartira seul à la cible, le doigt levé. */
  const startDrag = useCallback(() => {
    startScrubbing();
    countdown.hold();
    countdown.armResume();
  }, [startScrubbing, countdown]);

  // Le doigt se lève (ou s'immobilise) : le scrub RESTE ouvert — OK/▶︎❙❙
  // valident, BACK annule ; le décompte dit la suite (reprise, abandon).
  const endDrag = useCallback(() => {
    if (!scrubbingRef.current) return;
    setSpeedLabel(null);
    machine.touch();
    countdown.release();
  }, [machine, countdown]);

  /** Un APPUI ←/→ hors défilement, une fois tranché. Il n'appartient à la
   *  vidéo — le saut de son sens — que habillage caché, fond focalisé : sous la
   *  pilule de saut ou une carte, il sert leur focus ; habillage visible, la
   *  navigation. Ailleurs, il (r)allume l'habillage. */
  const tap = useCallback((dir: Dir) => {
    if (panelOpenRef.current || scrubbingRef.current) return;
    if (!overlayVisibleRef.current && backgroundHoldsFocus()) onJumpRef.current(dir);
    else showOverlay();
  }, [panelOpenRef, overlayVisibleRef, onJumpRef, showOverlay]);

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
      stepScrub(dir);
      return;
    }
    // Un appui que le relâchement tranchera (le down pouvait ouvrir un
    // maintien), ou déjà tranché par la plateforme.
    if (SCRUB_INPUT.tapOnRelease) hold.requestDeferredTap(dir);
    else tap(dir);
  }, [stepScrub, tap, panelOpenRef, skipAnyPressRef, hold]);

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

  // Le décompte, avec l'origine qu'une annulation rendrait (« Reprise à 12:34 »).
  const scrubCountdown = useMemo<ScrubCountdownView | null>(
    () => (countdownState ? { ...countdownState, origin: originRef.current } : null),
    [countdownState],
  );

  return {
    scrubbing, scrubPosition, speedLabel, scrubbingRef, scrubCountdown,
    scrubEndedAtRef, scrubStartedAtRef, lastMediaKeyAtRef,
    nudgeScrub, setSpeedLabel, startScrubbing, confirmScrub, cancelScrub,
    touchStart, startDrag, endDrag,
    handleDpadDirection,
    handleLongDirection: hold.handleLongDirection,
    onHoldRelease: hold.onHoldRelease,
    handleMediaSeekKey,
  };
}
