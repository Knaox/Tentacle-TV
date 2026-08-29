import { useCallback, useEffect, useMemo, useRef } from "react";
import { Platform } from "react-native";
import { createHoldMotor } from "@tentacle-tv/tv-core";

/** Maintien ←/→ avant d'entrer en avance/recul rapide, APRÈS le signal
 *  long-press système (~300 ms). Android : ~550-600 ms de maintien total —
 *  assez pour ignorer un appui nerveux, assez court pour être senti comme
 *  « je maintiens = avance rapide ». tvOS : ~1 s conservé (saisir la Siri
 *  Remote effleure facilement la couronne). */
const SCRUB_HOLD_EXTRA_MS = Platform.OS === "android" ? 250 : 700;
/** Détection de maintien AUTONOME (Android) pilotée par down/up uniquement :
 *  le signal long-press natif (longLeft/longRight) n'est PAS fiable partout —
 *  l'émulateur (clavier hôte) ne le déclenche jamais. Un key-DOWN sans key-UP
 *  au bout de ce délai = MAINTIEN. */
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
const sensOf = (dir: Dir): 1 | -1 => (dir === "forward" ? 1 : -1);
const dirOf = (sens: 1 | -1): Dir => (sens === 1 ? "forward" : "backward");

/**
 * L'ADAPTATEUR du maintien ←/→ — la mécanique (tic 250 ms, un palier par
 * seconde, chien de garde de silence) vit dans `creerMoteurMaintien`
 * (tv-core), la MÊME machine que la LG. Ne restent ici que les réalités
 * de plateforme que la machine n'a pas à connaître :
 *
 *  - la détection de maintien AUTONOME d'Android (down sans up = hold),
 *    doublée du signal long-press quand il existe ;
 *  - le délai d'armement avant d'engager (250 ms Android / 700 ms tvOS) ;
 *  - le réveil DIFFÉRÉ de l'OSD au key-up (Android) ;
 *  - l'arrêt NET au relâchement — la ceinture, quand la dalle émet le key-up
 *    que le chien de garde de la machine sait déjà déduire du silence.
 *
 * Les touches média (FF/RW) passent AUSSI par la machine : elle sait dire
 * cadence d'auto-répétition et appuis distincts — `sauter` fait le pas sec,
 * l'enchaînement engage le tic. C'était un accéléromètre maison avant.
 */
export function useScrubHoldMotor(args: {
  scrubbingRef: Ref<boolean>;
  panelOpenRef: Ref<boolean>;
  overlayVisibleRef: Ref<boolean>;
  /** Un pas SEC du fantôme (appui média isolé) — palier 1. */
  stepScrub: (dir: Dir) => void;
  /** Un tic de MAINTIEN — la machine fournit le palier (1/2/4/8). */
  tickScrub: (dir: Dir, palier: number) => void;
  showOverlay: () => void;
  /** Fin de maintien : éteint la pastille de vitesse. */
  onHoldEnd: () => void;
}) {
  const { scrubbingRef, panelOpenRef, overlayVisibleRef, stepScrub, tickScrub, showOverlay, onHoldEnd } = args;

  // Callbacks derrière des refs : le moteur est créé UNE fois.
  const stepRef = useRef(stepScrub); stepRef.current = stepScrub;
  const tickRef = useRef(tickScrub); tickRef.current = tickScrub;

  const tickingRef = useRef(false);
  const tickingStoppedAtRef = useRef(0);
  const lastCodeRef = useRef(0);
  // Réveil OSD en attente (tap ←/→ Android, OSD caché) — consommé au key-up.
  const pendingWakeRef = useRef(false);

  const moteur = useMemo(
    () =>
      createHoldMotor({
        jump: (sens) => stepRef.current(dirOf(sens)),
        advance: (sens, palier) => {
          tickingRef.current = true;
          tickRef.current(dirOf(sens), palier);
        },
      }),
    [],
  );
  useEffect(() => () => moteur.destroy(), [moteur]);

  const markTickingStopped = useCallback(() => {
    if (tickingRef.current) tickingStoppedAtRef.current = Date.now();
    tickingRef.current = false;
  }, []);

  /** Engagement du maintien — idempotent. `repetition: true` force le tic
   *  immédiat de la machine ; le scrub s'AMORCE tout seul au premier tic
   *  (machine.pas ouvre le déplacement si besoin). */
  const engageHold = useCallback((dir: Dir) => {
    pendingWakeRef.current = false;
    tickingRef.current = true;
    lastCodeRef.current = CODES.dpad[dir];
    moteur.press(CODES.dpad[dir], sensOf(dir), true);
  }, [moteur]);

  // --- Armement différé (signal long-press natif) ---
  const scrubHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelScrubHold = useCallback(() => {
    if (scrubHoldTimerRef.current) { clearTimeout(scrubHoldTimerRef.current); scrubHoldTimerRef.current = null; }
  }, []);
  useEffect(() => () => cancelScrubHold(), [cancelScrubHold]);

  const handleLongDirection = useCallback((dir: Dir) => {
    if (panelOpenRef.current || overlayVisibleRef.current) return;
    if (scrubbingRef.current) {
      // DÉJÀ en scrub : le maintien accélère IMMÉDIATEMENT — pas d'armement.
      engageHold(dir);
      return;
    }
    if (scrubHoldTimerRef.current) clearTimeout(scrubHoldTimerRef.current);
    scrubHoldTimerRef.current = setTimeout(() => {
      scrubHoldTimerRef.current = null;
      engageHold(dir);
    }, SCRUB_HOLD_EXTRA_MS);
  }, [engageHold, panelOpenRef, overlayVisibleRef, scrubbingRef]);

  // --- Détection de maintien AUTONOME (Android) : armée au key-DOWN ←/→,
  //     annulée par le key-up. Seul mécanisme fiable sur émulateur. ---
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
    moteur.press(CODES.media[dir], sensOf(dir), false);
  }, [moteur]);

  /** Tap ←/→ OSD caché (Android) : demande un réveil au KEY-UP. */
  const requestDeferredWake = useCallback(() => { pendingWakeRef.current = true; }, []);

  /** Nettoyage au key-up (fin de maintien) : la ceinture explicite, en plus du
   *  chien de garde de silence de la machine. */
  const onHoldRelease = useCallback(() => {
    cancelScrubHold();
    cancelHoldFromDown();
    moteur.release(lastCodeRef.current);
    markTickingStopped();
    onHoldEnd();
    if (pendingWakeRef.current) {
      pendingWakeRef.current = false;
      if (!scrubbingRef.current && !panelOpenRef.current) showOverlay();
    }
  }, [cancelScrubHold, cancelHoldFromDown, moteur, markTickingStopped, onHoldEnd, showOverlay, scrubbingRef, panelOpenRef]);

  /** Rupture franche — confirm/annulation du scrub : même si le key-up
   *  n'arrive jamais, valider ou annuler tue l'armement ET le tic. */
  const stopAll = useCallback(() => {
    cancelScrubHold();
    cancelHoldFromDown();
    moteur.cancel();
    markTickingStopped();
    pendingWakeRef.current = false;
  }, [cancelScrubHold, cancelHoldFromDown, moteur, markTickingStopped]);

  /** Tic de maintien actif (ou stoppé il y a < 400 ms) : les events ←/→
   *  concomitants sont des doublons parasites du hold. */
  const isHoldTicking = useCallback(() =>
    tickingRef.current || Date.now() - tickingStoppedAtRef.current < 400, []);

  return { handleLongDirection, onHoldRelease, requestDeferredWake, armHoldFromDown, mediaPulse, stopAll, isHoldTicking };
}
