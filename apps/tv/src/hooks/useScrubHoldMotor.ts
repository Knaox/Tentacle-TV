import { useCallback, useEffect, useRef } from "react";
import { Platform } from "react-native";

/** Cadence d'avance du curseur pendant un MAINTIEN ←/→ : react-native-tvos
 *  n'émet PAS les répétitions système pendant un hold — sans ce tick JS, le
 *  scrub démarrait (pause) mais le curseur ne bougeait jamais.
 *  DOIT rester < HOLD_RELEASE_MS (useScrubController) pour entretenir le
 *  palier d'accélération. */
const HOLD_SCRUB_TICK_MS = 250;
/** Maintien ←/→ avant d'entrer en avance/recul rapide, APRÈS le signal
 *  long-press système (~300 ms). Android : ~550-600 ms de maintien total —
 *  assez pour ignorer un appui nerveux, assez court pour être senti comme
 *  « je maintiens = avance rapide ». tvOS : ~1 s conservé (saisir la Siri
 *  Remote effleure facilement la couronne). */
const SCRUB_HOLD_EXTRA_MS = Platform.OS === "android" ? 250 : 700;
/** Détection de maintien AUTONOME (Android) pilotée par down/up uniquement :
 *  le signal long-press natif (longLeft/longRight, basé sur le repeatCount
 *  des KeyEvents) n'est PAS fiable partout — l'émulateur (clavier hôte) ne
 *  le déclenche jamais → « un +10 puis plus rien ». Un key-DOWN sans key-UP
 *  au bout de ce délai = MAINTIEN. Le key-up (toujours émis : `right` OU
 *  `longRight` a=1) annule ou arrête. */
const HOLD_FROM_DOWN_SCRUB_MS = 400;
/** Idem, depuis la lecture (OSD caché) : délai avant d'ENGAGER le scrub. */
const HOLD_FROM_DOWN_ENGAGE_MS = 550;

type Ref<T> = React.MutableRefObject<T>;

/**
 * MOTEUR DE MAINTIEN ←/→ (extrait de useScrubController — budget 300 lignes) :
 * armement différé du scrub au long-press, tick JS d'avance continue, réveil
 * DIFFÉRÉ de l'OSD (Android) et arrêt NET au relâchement.
 *
 * Réveil différé : sur Android le tap ←/→ n'affiche plus l'OSD au key-down
 * (l'OSD devenait visible avant le signal long-press et bloquait l'avance
 * rapide au maintien) — il s'affiche au key-up si aucun scrub n'a été engagé.
 */
export function useScrubHoldMotor(args: {
  scrubbingRef: Ref<boolean>;
  panelOpenRef: Ref<boolean>;
  overlayVisibleRef: Ref<boolean>;
  holdRef: Ref<{ dir: "forward" | "backward"; startTime: number } | null>;
  startScrubbing: (dir: "forward" | "backward") => void;
  moveScrub: (dir: "forward" | "backward") => void;
  showOverlay: () => void;
  armIdleCancel: () => void;
  endHold: () => void;
}) {
  const {
    scrubbingRef, panelOpenRef, overlayVisibleRef, holdRef,
    startScrubbing, moveScrub, showOverlay, armIdleCancel, endHold,
  } = args;

  const scrubHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdScrubIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const holdScrubStoppedAtRef = useRef(0);
  // Réveil OSD en attente (tap ←/→ Android, OSD caché) — consommé au key-up.
  const pendingWakeRef = useRef(false);

  const stopHoldScrub = useCallback(() => {
    if (holdScrubIntervalRef.current) {
      clearInterval(holdScrubIntervalRef.current);
      holdScrubIntervalRef.current = null;
      holdScrubStoppedAtRef.current = Date.now();
    }
  }, []);
  useEffect(() => () => stopHoldScrub(), [stopHoldScrub]);

  const cancelScrubHold = useCallback(() => {
    if (scrubHoldTimerRef.current) { clearTimeout(scrubHoldTimerRef.current); scrubHoldTimerRef.current = null; }
  }, []);
  useEffect(() => () => cancelScrubHold(), [cancelScrubHold]);

  // Direction du tick en cours — un maintien dans l'AUTRE sens re-démarre le
  // tick avec la nouvelle direction au lieu d'être ignoré.
  const tickDirRef = useRef<"forward" | "backward" | null>(null);

  const startTicking = useCallback((dir: "forward" | "backward") => {
    stopHoldScrub();
    tickDirRef.current = dir;
    holdScrubIntervalRef.current = setInterval(() => {
      // Auto-guérison : scrub terminé (OK/Back/annulation) sans key-up reçu
      // (event perdu/annulé côté système) → JAMAIS de tick fantôme résiduel.
      if (!scrubbingRef.current) { stopHoldScrub(); return; }
      moveScrub(dir);
    }, HOLD_SCRUB_TICK_MS);
  }, [stopHoldScrub, moveScrub, scrubbingRef]);

  /** Engagement du maintien — idempotent : ouvre le scrub si besoin, (re)part
   *  le tick si absent ou dans l'autre sens. Appelé par le signal long-press
   *  natif ET par la détection autonome down/up — le premier arrivé gagne. */
  const engageHold = useCallback((dir: "forward" | "backward") => {
    pendingWakeRef.current = false;
    if (!scrubbingRef.current) startScrubbing(dir);
    if (!holdScrubIntervalRef.current || tickDirRef.current !== dir) startTicking(dir);
  }, [startScrubbing, startTicking, scrubbingRef]);

  const handleLongDirection = useCallback((dir: "forward" | "backward") => {
    if (panelOpenRef.current || overlayVisibleRef.current) return;
    if (scrubbingRef.current) {
      // DÉJÀ en scrub (bouton ⏩, maintien précédent, appui simple) : le
      // maintien accélère IMMÉDIATEMENT — pas de délai d'armement. Android
      // n'émet NI répétition de ←/→ NI second longLeft/longRight pendant un
      // hold : sans ce branchement, maintenir une flèche dans le scrub ne
      // faisait qu'un pas (+10) puis plus rien.
      engageHold(dir);
      return;
    }
    if (scrubHoldTimerRef.current) clearTimeout(scrubHoldTimerRef.current);
    scrubHoldTimerRef.current = setTimeout(() => {
      scrubHoldTimerRef.current = null;
      engageHold(dir); // le maintien a engagé le scrub → pas de réveil OSD
    }, SCRUB_HOLD_EXTRA_MS);
  }, [engageHold, panelOpenRef, overlayVisibleRef, scrubbingRef]);

  // --- Détection de maintien AUTONOME (Android) : armée au key-DOWN ←/→,
  //     annulée par le key-up (onHoldRelease). Indépendante de longLeft/
  //     longRight — seul mécanisme qui fonctionne sur émulateur. ---
  const holdFromDownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelHoldFromDown = useCallback(() => {
    if (holdFromDownTimerRef.current) { clearTimeout(holdFromDownTimerRef.current); holdFromDownTimerRef.current = null; }
  }, []);
  useEffect(() => () => cancelHoldFromDown(), [cancelHoldFromDown]);

  const armHoldFromDown = useCallback((dir: "forward" | "backward") => {
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

  /** Tap ←/→ OSD caché (Android) : demande un réveil au KEY-UP. */
  const requestDeferredWake = useCallback(() => { pendingWakeRef.current = true; }, []);

  /** Nettoyage au key-up (fin de maintien) : stoppe armement + tick +
   *  accélération, consomme le réveil différé. Un scrub laissé ouvert
   *  s'annulera seul sur inactivité (aucun seek). */
  const onHoldRelease = useCallback(() => {
    cancelScrubHold();
    cancelHoldFromDown();
    stopHoldScrub();
    if (holdRef.current) endHold();
    if (scrubbingRef.current) armIdleCancel();
    if (pendingWakeRef.current) {
      pendingWakeRef.current = false;
      if (!scrubbingRef.current && !panelOpenRef.current) showOverlay();
    }
  }, [cancelScrubHold, cancelHoldFromDown, stopHoldScrub, endHold, armIdleCancel, showOverlay, holdRef, scrubbingRef, panelOpenRef]);

  /** Arrêt de TOUS les moteurs — appelé par confirmScrub/cancelScrub : même si
   *  le key-up n'arrive jamais (long-press annulé par tvOS), valider ou
   *  annuler le scrub tue l'armement ET le tick. */
  const stopAll = useCallback(() => {
    cancelScrubHold();
    cancelHoldFromDown();
    stopHoldScrub();
    pendingWakeRef.current = false;
  }, [cancelScrubHold, cancelHoldFromDown, stopHoldScrub]);

  /** Tick de maintien actif (ou stoppé il y a < 400 ms) : les events ←/→
   *  concomitants sont des doublons parasites du hold. */
  const isHoldTicking = useCallback(() =>
    holdScrubIntervalRef.current != null || Date.now() - holdScrubStoppedAtRef.current < 400, []);

  return { handleLongDirection, onHoldRelease, requestDeferredWake, armHoldFromDown, stopAll, isHoldTicking };
}
