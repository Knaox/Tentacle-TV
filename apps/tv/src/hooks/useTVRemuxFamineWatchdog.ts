import { useEffect, useRef, type MutableRefObject } from "react";
import type { RemuxInfo } from "./useTVRemuxInfo";
import { plog } from "../utils/playerDiag";

/** Aucun onProgress depuis ce délai en lecture remux active → tentative de récupération. */
const STALL_RECOVER_MS = 8000;
/** Données minimales DEVANT la tête pour qu'un remount ait un sens (sinon producteur affamé). */
const MIN_AHEAD_SEC = 4;
/** Garde anti-boucle : au-delà de GUARD_MAX récupérations famine dans la fenêtre → erreur surfacée. */
const GUARD_MAX = 3;
const GUARD_WINDOW_MS = 120000;

/**
 * Filet ANTI-FAMINE du remux local tvOS.
 *
 * La récupération de stall n'était armée QUE par l'erreur AVPlayer -11866
 * (useTVRemuxStallRecovery) : un stall par famine de buffer SANS erreur (reprise
 * de pause, race de production au bord live) laissait un spinner infini — le
 * watchdog de useTVPlayerEventHandlers n'affiche le spinner que sans jamais
 * récupérer, et `onBuffer` n'est pas branché.
 *
 * Ici : plus aucun onProgress depuis STALL_RECOVER_MS pendant une lecture remux
 * active, alors que des données existent devant la tête (ou que le remux est
 * terminé) → même chemin de récupération que le -11866 (remount à la position
 * courante via onRemuxStall). Si le PRODUCTEUR est lui-même affamé (source
 * réseau lente : written ≈ position), un remount relirait la même source lente →
 * pas de déclenchement, le spinner existant reste.
 *
 * Garde interne (3 récupérations / 120 s) : la garde de useTVErrorHandler
 * (>4 en <8 s) ne peut mathématiquement pas attraper un déclencheur espacé de
 * 8 s — chaque déclencheur porte la sienne.
 */
export function useTVRemuxFamineWatchdog(args: {
  isLocalRemux: boolean;
  hasStarted: boolean;
  pausedStateRef: MutableRefObject<boolean>;
  endedRef: MutableRefObject<boolean>;
  deadSessionRef: MutableRefObject<boolean>;
  softReloadRef: MutableRefObject<boolean>;
  /** Miroir de `reloadHold` (PlayerScreen) : un reload de reprise/seek est en vol. */
  reloadHoldRef: MutableRefObject<boolean>;
  lastProgressTime: MutableRefObject<number>;
  positionRef: MutableRefObject<number>;
  infoRef: MutableRefObject<RemuxInfo | null>;
  onRemuxStall: () => void;
  setVideoError: (e: string | null) => void;
}): void {
  const {
    isLocalRemux, hasStarted, pausedStateRef, endedRef, deadSessionRef,
    softReloadRef, reloadHoldRef, lastProgressTime, positionRef, infoRef,
    onRemuxStall, setVideoError,
  } = args;
  /** Dernier instant où le watchdog était « au repos » (pause/reload/re-arm) — le
   *  délai de famine court depuis max(dernier progress, dernier ré-armement). */
  const armedAtRef = useRef(0);
  const guardRef = useRef<number[]>([]);

  useEffect(() => {
    if (!isLocalRemux || !hasStarted) return;
    armedAtRef.current = Date.now();
    const id = setInterval(() => {
      // Ré-armement : pause (AVPlayer n'émet plus de progress), fin, reload en vol,
      // session morte (la reprise est pilotée par useTVRemuxPause, pas par nous).
      if (pausedStateRef.current || endedRef.current || softReloadRef.current
          || reloadHoldRef.current || deadSessionRef.current) {
        armedAtRef.current = Date.now();
        return;
      }
      const idleSince = Math.max(lastProgressTime.current, armedAtRef.current);
      if (Date.now() - idleSince < STALL_RECOVER_MS) return;
      // Un remount n'a de sens que si des données existent devant la tête, ou si le
      // remux est terminé (done couvre aussi une session en erreur : le start() de
      // récupération recrée alors une session fraîche — retry d'une panne réseau).
      const info = infoRef.current;
      const ahead = info ? info.sessionStartSec + info.writtenSec - positionRef.current : 0;
      if (!info || (!info.done && ahead < MIN_AHEAD_SEC)) {
        armedAtRef.current = Date.now();   // producteur affamé → re-tester dans 8 s
        return;
      }
      const now = Date.now();
      guardRef.current = guardRef.current.filter((t) => now - t < GUARD_WINDOW_MS);
      if (guardRef.current.length >= GUARD_MAX) {
        plog("famine", `${GUARD_MAX} récupérations en <120 s → Playback Stopped`);
        setVideoError("Playback Stopped");
        armedAtRef.current = now;
        return;
      }
      guardRef.current.push(now);
      armedAtRef.current = now;
      plog("famine", `aucun progress depuis 8 s @${positionRef.current.toFixed(1)}s (avance dispo=${ahead.toFixed(1)}s, done=${info?.done ? 1 : 0}) → récupération`);
      onRemuxStall();
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLocalRemux, hasStarted]);
}
