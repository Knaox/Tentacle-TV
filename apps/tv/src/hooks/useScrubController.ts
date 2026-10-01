import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { createScrubMachine } from "@tentacle-tv/tv-core";
import { backgroundHoldsFocus } from "../components/player/focus/osdFocusBus";
import { SCRUB_INPUT } from "./scrubInput";
import { useScrubHoldMotor } from "./useScrubHoldMotor";

type Dir = "forward" | "backward";
type Ref<T> = MutableRefObject<T>;

const signOf = (dir: Dir): 1 | -1 => (dir === "forward" ? 1 : -1);

/**
 * Le pas d'un APPUI sur une flèche — dix secondes, dans les deux sens, comme
 * le lecteur d'Apple (et Netflix sur Apple TV, qui l'a longtemps été) : un
 * saut de la lecture, habillage caché ; un pas fin du curseur, en défilement.
 * L'accélération est réservée au MAINTIEN.
 */
export const ARROW_JUMP_SECONDS = 10;

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
  /** Un appui simple qui appartient à la vidéo : le saut de ±10 s. */
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
 *    lecture de ±10 s habillage caché, le curseur de ±10 s en défilement), un
 *    MAINTIEN défile en accélérant ; la couture `SCRUB_INPUT` dit seulement
 *    comment la plateforme les émet ;
 *  - la TRAPPE du curseur — voir `nudgeScrub`.
 *
 * **La trappe.** Le glisser du pavé avance par deltas CONTINUS, l'appui fin
 * de dix secondes : la machine ne connaît que ses pas proportionnels. La
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

  const clampDisplay = useCallback((value: number) => {
    const duration = durationRef.current || 0;
    if (!(duration > 0)) return Math.max(0, value);
    return Math.min(Math.max(0, value), duration);
  }, [durationRef]);

  const setDisplay = useCallback((value: number) => {
    scrubPositionRef.current = value;
    setScrubPosition(value);
  }, []);

  const machine = useMemo(() => createScrubMachine({
    readPosition: () => currentTimeRef.current,
    readDuration: () => durationRef.current || 0,
    readPaused: () => pausedRef.current,
    onEnter: (position) => {
      scrubStartedAtRef.current = Date.now();
      scrubbingRef.current = true;
      setScrubbing(true);
      machineLastRef.current = position;
      setDisplay(position);
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
      // skips ±10/30 synchronisée AVANT le seek : un +30 immédiat après la
      // confirmation ne doit pas repartir de la position pré-scrub.
      currentTimeRef.current = scrubPositionRef.current;
      onSeekRef.current(scrubPositionRef.current);
    },
    onExit: () => {
      stopMotorsRef.current();
      scrubEndedAtRef.current = Date.now();
      scrubbingRef.current = false;
      setScrubbing(false);
      setSpeedLabel(null);
      showOverlay();
    },
    // Machine unique : toutes les entrées passent par des refs stables.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);
  useEffect(() => () => machine.destroy(), [machine]);

  // Avance du curseur hors des pas de la machine (glisser du pavé, appui
  // fin) : delta signé en secondes — la TRAPPE (cf. en-tête).
  const nudgeScrub = useCallback((deltaSeconds: number) => {
    machine.touch();
    setDisplay(clampDisplay(scrubPositionRef.current + deltaSeconds));
  }, [machine, clampDisplay, setDisplay]);

  /** Un pas SEC (appui simple ←/→ ou touche média isolée) : dix secondes,
   *  jamais d'accélération — elle est réservée au MAINTIEN (tic du moteur). */
  const stepScrub = useCallback((dir: Dir) => {
    setSpeedLabel(null);
    nudgeScrub(signOf(dir) * ARROW_JUMP_SECONDS);
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

  // Le doigt se lève : le scrub RESTE ouvert — OK/▶︎❙❙ valident, BACK
  // annule, l'inactivité annule seule SANS seek.
  const endDrag = useCallback(() => {
    if (!scrubbingRef.current) return;
    setSpeedLabel(null);
    machine.touch();
  }, [machine]);

  /** Un APPUI ←/→ hors défilement, une fois tranché. Il n'appartient à la
   *  vidéo — saut de ±10 s — que habillage caché, fond focalisé : sous la
   *  pilule de saut ou une carte, il sert leur focus ; habillage visible, la
   *  navigation. Ailleurs, il (r)allume l'habillage. */
  const tap = useCallback((dir: Dir) => {
    if (panelOpenRef.current || scrubbingRef.current) return;
    if (!overlayVisibleRef.current && backgroundHoldsFocus()) onJumpRef.current(dir);
    else showOverlay();
  }, [panelOpenRef, overlayVisibleRef, onJumpRef, showOverlay]);

  // --- Maintien ←/→ et touches média : l'adaptateur du moteur tv-core. ---
  const engage = useCallback(() => startScrubbing(), [startScrubbing]);
  const hold = useScrubHoldMotor({
    scrubbingRef, panelOpenRef, overlayVisibleRef,
    stepScrub, tickScrub, onEngage: engage, onTap: tap,
    onHoldEnd: () => setSpeedLabel(null),
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

  return {
    scrubbing, scrubPosition, speedLabel, scrubbingRef,
    scrubEndedAtRef, scrubStartedAtRef, lastMediaKeyAtRef,
    nudgeScrub, setSpeedLabel, startScrubbing, confirmScrub, cancelScrub, endDrag,
    handleDpadDirection,
    handleLongDirection: hold.handleLongDirection,
    onHoldRelease: hold.onHoldRelease,
    handleMediaSeekKey,
  };
}
