import { useCallback, useEffect, useMemo, useRef } from "react";
import { createHoldMotor } from "@tentacle-tv/tv-core";
import { SCRUB_INPUT } from "./scrubInput";

/** Détection de maintien AUTONOME (`SCRUB_INPUT.holdFromKeyDown`) pilotée par
 *  down/up uniquement : un key-DOWN sans key-UP au bout de ce délai = MAINTIEN. */
const HOLD_FROM_DOWN_SCRUB_MS = 400;
/** Idem, depuis la lecture (OSD caché) : délai avant d'ENGAGER le scrub. */
const HOLD_FROM_DOWN_ENGAGE_MS = 550;

type Dir = "forward" | "backward";
type Ref<T> = React.MutableRefObject<T>;

/** Codes internes du moteur — il ne s'en sert que pour l'égalité. Les touches
 *  média ont les leurs : un maintien de flèche et un maintien FF ne doivent
 *  pas s'enchaîner l'un l'autre. */
const CODES: Record<"dpad" | "media", Record<Dir, number>> = {
  dpad: { forward: 1, backward: 2 },
  media: { forward: 3, backward: 4 },
};
const signOf = (dir: Dir): 1 | -1 => (dir === "forward" ? 1 : -1);
const dirOf = (sign: 1 | -1): Dir => (sign === 1 ? "forward" : "backward");

/**
 * L'ADAPTATEUR du maintien ←/→ — la mécanique (tic 250 ms, un palier par
 * seconde, chien de garde de silence) vit dans `createHoldMotor` (tv-core),
 * la MÊME machine que la LG. Ce qui dépend de la plateforme vient de sa
 * couture (`SCRUB_INPUT`, `scrubInput[.ios].ts`), jamais d'un `Platform.OS` :
 *
 *  - la détection de maintien AUTONOME (down sans up), doublée du signal
 *    d'appui long natif quand il existe ;
 *  - le délai d'armement après ce signal ;
 *  - la fin du maintien : déduite du silence des répétitions (Android), ou
 *    ANNONCÉE par le relâchement de l'appui long (Apple TV, `motor.hold`) —
 *    le chien de garde coupait celui-ci au bout de 0,7 s ;
 *  - l'appui simple tranché au key-up (`requestDeferredTap`) quand le down
 *    pouvait encore ouvrir un maintien.
 *
 * Engager un maintien OUVRE le défilement aussitôt (`onEngage`) : la vue paraît
 * sous le doigt, le premier tic ne vient qu'un quart de seconde plus tard.
 *
 * Les touches média (FF/RW) passent AUSSI par la machine : elle sait dire
 * cadence d'auto-répétition et appuis distincts — `jump` fait le pas sec,
 * l'enchaînement engage le tic.
 */
export function useScrubHoldMotor(args: {
  scrubbingRef: Ref<boolean>;
  panelOpenRef: Ref<boolean>;
  overlayVisibleRef: Ref<boolean>;
  /** Un pas SEC du fantôme (appui média isolé). */
  stepScrub: (dir: Dir) => void;
  /** Un tic de MAINTIEN — la machine fournit le palier (1/2/4/8). */
  tickScrub: (dir: Dir, tier: number) => void;
  /** Le maintien s'engage : le défilement s'ouvre, sans attendre le premier tic. */
  onEngage: () => void;
  /** Un appui simple, tranché au relâchement (`requestDeferredTap`). */
  onTap: (dir: Dir) => void;
  /** Fin de maintien : éteint la pastille de vitesse. */
  onHoldEnd: () => void;
}) {
  const { scrubbingRef, panelOpenRef, overlayVisibleRef, stepScrub, tickScrub, onEngage, onTap, onHoldEnd } = args;

  // Callbacks derrière des refs : le moteur est créé UNE fois.
  const stepRef = useRef(stepScrub); stepRef.current = stepScrub;
  const tickRef = useRef(tickScrub); tickRef.current = tickScrub;

  const tickingRef = useRef(false);
  const tickingStoppedAtRef = useRef(0);
  const lastCodeRef = useRef(0);
  // Appui en attente du key-up (le down pouvait ouvrir un maintien).
  const pendingTapRef = useRef<Dir | null>(null);

  const motor = useMemo(
    () =>
      createHoldMotor({
        jump: (sign) => stepRef.current(dirOf(sign)),
        advance: (sign, tier) => {
          tickingRef.current = true;
          tickRef.current(dirOf(sign), tier);
        },
      }),
    [],
  );
  useEffect(() => () => motor.destroy(), [motor]);

  const markTickingStopped = useCallback(() => {
    if (tickingRef.current) tickingStoppedAtRef.current = Date.now();
    tickingRef.current = false;
  }, []);

  /** Engagement du maintien — idempotent : le défilement s'ouvre, le tic part
   *  (fin annoncée : `hold` ; sinon `press` en répétition, que le silence
   *  arrêtera). */
  const engageHold = useCallback((dir: Dir) => {
    pendingTapRef.current = null;
    tickingRef.current = true;
    lastCodeRef.current = CODES.dpad[dir];
    onEngage();
    if (SCRUB_INPUT.holdEndAnnounced) motor.hold(CODES.dpad[dir], signOf(dir));
    else motor.press(CODES.dpad[dir], signOf(dir), true);
  }, [motor, onEngage]);

  // --- Armement différé (signal d'appui long natif) ---
  const scrubHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelScrubHold = useCallback(() => {
    if (scrubHoldTimerRef.current) { clearTimeout(scrubHoldTimerRef.current); scrubHoldTimerRef.current = null; }
  }, []);
  useEffect(() => () => cancelScrubHold(), [cancelScrubHold]);

  const handleLongDirection = useCallback((dir: Dir) => {
    if (panelOpenRef.current || overlayVisibleRef.current) return;
    // DÉJÀ en scrub, ou rien à attendre : le maintien accélère IMMÉDIATEMENT.
    if (scrubbingRef.current || SCRUB_INPUT.holdArmMs <= 0) {
      engageHold(dir);
      return;
    }
    if (scrubHoldTimerRef.current) clearTimeout(scrubHoldTimerRef.current);
    scrubHoldTimerRef.current = setTimeout(() => {
      scrubHoldTimerRef.current = null;
      engageHold(dir);
    }, SCRUB_INPUT.holdArmMs);
  }, [engageHold, panelOpenRef, overlayVisibleRef, scrubbingRef]);

  // --- Détection de maintien AUTONOME : armée au key-DOWN ←/→, annulée par
  //     le key-up. Seul mécanisme fiable sur l'émulateur Android. ---
  const holdFromDownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelHoldFromDown = useCallback(() => {
    if (holdFromDownTimerRef.current) { clearTimeout(holdFromDownTimerRef.current); holdFromDownTimerRef.current = null; }
  }, []);
  useEffect(() => () => cancelHoldFromDown(), [cancelHoldFromDown]);

  const armHoldFromDown = useCallback((dir: Dir) => {
    cancelHoldFromDown();
    const delay = scrubbingRef.current ? HOLD_FROM_DOWN_SCRUB_MS : HOLD_FROM_DOWN_ENGAGE_MS;
    holdFromDownTimerRef.current = setTimeout(() => {
      holdFromDownTimerRef.current = null;
      // Gardes évaluées au DÉCLENCHEMENT : panneau ouvert ou OSD visible hors
      // scrub = mode navigation, jamais d'avance rapide.
      if (panelOpenRef.current) return;
      if (!scrubbingRef.current && overlayVisibleRef.current) return;
      engageHold(dir);
    }, delay);
  }, [cancelHoldFromDown, engageHold, panelOpenRef, overlayVisibleRef, scrubbingRef]);

  /** Touche média FF/RW : la machine départage appui isolé (pas sec) et
   *  cadence de répétition (tic accéléré). */
  const mediaPulse = useCallback((dir: Dir) => {
    lastCodeRef.current = CODES.media[dir];
    motor.press(CODES.media[dir], signOf(dir), false);
  }, [motor]);

  /** Un appui ←/→ que le key-up tranchera : sans maintien engagé d'ici là,
   *  c'est un appui simple (`onTap`). */
  const requestDeferredTap = useCallback((dir: Dir) => { pendingTapRef.current = dir; }, []);

  /** Nettoyage au key-up (fin de maintien) : la ceinture explicite, en plus du
   *  chien de garde de silence de la machine — et, sur Apple TV, la fin du
   *  maintien elle-même. */
  const onHoldRelease = useCallback(() => {
    cancelScrubHold();
    cancelHoldFromDown();
    motor.release(lastCodeRef.current);
    markTickingStopped();
    onHoldEnd();
    const tap = pendingTapRef.current;
    pendingTapRef.current = null;
    if (tap && !scrubbingRef.current && !panelOpenRef.current) onTap(tap);
  }, [cancelScrubHold, cancelHoldFromDown, motor, markTickingStopped, onHoldEnd, onTap, scrubbingRef, panelOpenRef]);

  /** Rupture franche — confirm/annulation du scrub : même si le key-up
   *  n'arrive jamais, valider ou annuler tue l'armement ET le tic. */
  const stopAll = useCallback(() => {
    cancelScrubHold();
    cancelHoldFromDown();
    motor.cancel();
    markTickingStopped();
    pendingTapRef.current = null;
  }, [cancelScrubHold, cancelHoldFromDown, motor, markTickingStopped]);

  /** Tic de maintien actif (ou stoppé il y a < 400 ms) : les events ←/→
   *  concomitants sont des doublons parasites du hold. */
  const isHoldTicking = useCallback(() =>
    tickingRef.current || Date.now() - tickingStoppedAtRef.current < 400, []);

  return { handleLongDirection, onHoldRelease, requestDeferredTap, armHoldFromDown, mediaPulse, stopAll, isHoldTicking };
}
