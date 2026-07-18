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

  const handleLongDirection = useCallback((dir: "forward" | "backward") => {
    if (panelOpenRef.current || scrubbingRef.current) return;
    if (overlayVisibleRef.current) return; // OSD visible = navigation, pas d'avance rapide
    if (scrubHoldTimerRef.current) clearTimeout(scrubHoldTimerRef.current);
    scrubHoldTimerRef.current = setTimeout(() => {
      scrubHoldTimerRef.current = null;
      pendingWakeRef.current = false; // le maintien a engagé le scrub → pas de réveil OSD
      startScrubbing(dir);
      stopHoldScrub();
      holdScrubIntervalRef.current = setInterval(() => {
        // Auto-guérison : scrub terminé (OK/Back/annulation) sans key-up reçu
        // (event perdu/annulé côté système) → JAMAIS de tick fantôme résiduel.
        if (!scrubbingRef.current) { stopHoldScrub(); return; }
        moveScrub(dir);
      }, HOLD_SCRUB_TICK_MS);
    }, SCRUB_HOLD_EXTRA_MS);
  }, [startScrubbing, stopHoldScrub, moveScrub, panelOpenRef, overlayVisibleRef, scrubbingRef]);

  /** Tap ←/→ OSD caché (Android) : demande un réveil au KEY-UP. */
  const requestDeferredWake = useCallback(() => { pendingWakeRef.current = true; }, []);

  /** Nettoyage au key-up (fin de maintien) : stoppe armement + tick +
   *  accélération, consomme le réveil différé. Un scrub laissé ouvert
   *  s'annulera seul sur inactivité (aucun seek). */
  const onHoldRelease = useCallback(() => {
    cancelScrubHold();
    stopHoldScrub();
    if (holdRef.current) endHold();
    if (scrubbingRef.current) armIdleCancel();
    if (pendingWakeRef.current) {
      pendingWakeRef.current = false;
      if (!scrubbingRef.current && !panelOpenRef.current) showOverlay();
    }
  }, [cancelScrubHold, stopHoldScrub, endHold, armIdleCancel, showOverlay, holdRef, scrubbingRef, panelOpenRef]);

  /** Arrêt de TOUS les moteurs — appelé par confirmScrub/cancelScrub : même si
   *  le key-up n'arrive jamais (long-press annulé par tvOS), valider ou
   *  annuler le scrub tue l'armement ET le tick. */
  const stopAll = useCallback(() => {
    cancelScrubHold();
    stopHoldScrub();
    pendingWakeRef.current = false;
  }, [cancelScrubHold, stopHoldScrub]);

  /** Tick de maintien actif (ou stoppé il y a < 400 ms) : les events ←/→
   *  concomitants sont des doublons parasites du hold. */
  const isHoldTicking = useCallback(() =>
    holdScrubIntervalRef.current != null || Date.now() - holdScrubStoppedAtRef.current < 400, []);

  return { handleLongDirection, onHoldRelease, requestDeferredWake, stopAll, isHoldTicking };
}
