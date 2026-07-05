import { useCallback, useEffect, useRef } from "react";
import { NativeModules } from "react-native";
import { TICKS_PER_SECOND } from "@tentacle-tv/shared";
import type { RemuxInfo } from "./useTVRemuxInfo";

const Remux = (NativeModules as { TVLocalRemux?: { prepareResume?: () => void } }).TVLocalRemux;

/** Fenêtre de regroupement des appuis rapides : un spam +30/+30/+30 = UN seul re-remux à la cible finale. */
const SEEK_DEBOUNCE_MS = 350;
/** Seek DIFFÉRÉ (cible devant l'écrit) : cadence de re-vérification + délai avant repli re-remux. */
const DEFER_POLL_MS = 300;
const DEFER_TIMEOUT_MS = 7000;
/** Marge devant la fin d'écrit pour un seek natif (segment en cours d'écriture). */
const WRITTEN_MARGIN_SEC = 1;

/**
 * Routage du SEEK sur le lecteur REMUX local tvOS (« façon Infuse »).
 *
 * Par appui (décisions SYNCHRONES sur `infoRef`, le poll 1 Hz de sessionInfo) :
 *  1. re-remux déjà en attente (debounce) → TOUJOURS coalescer : réévaluer la fenêtre contre la
 *     position OPTIMISTE re-routait le 2ᵉ appui en seek natif sur la VIEILLE session (clamp au
 *     bord live) tout en laissant partir le re-remux vers la 1ʳᵉ cible → double saut/rollback.
 *  2. cible dans `[max(débutSession, pos−55) … min(écrit−1, pos+295)]` → seek NATIF immédiat
 *     (réutilise la session : zéro re-remux). La borne haute suit désormais ce qui est ÉCRIT :
 *     juste après un start(), seuls ~3-8 s existent — un seek natif « dans les +295 » clampait
 *     au bord live, AVANT la cible (« +30 qui recule »).
 *  3. cible devant l'écrit mais dans la fenêtre de pacing (+295) → seek natif DIFFÉRÉ : le
 *     producteur y arrive en ~1-3 s (il file jusqu'à playPos+300) ; on fige l'affichage sur la
 *     cible (gate) et on seek dès que produit. Timeout → repli re-remux.
 *  4. hors fenêtre (gros saut, arrière purgé) → re-remux d'une session fraîche à la cible, gate
 *     anti-progress-périmé armé IMMÉDIATEMENT (pendant les 350 ms de debounce, les progress de
 *     l'ancienne session écrasaient position + base des +30 → rollback visible), debounce cumulé.
 *
 * Android / direct play / transcode natif (`isLocalRemuxRef=false`) : seek natif direct INCHANGÉ.
 */
export function useTVRemuxSeek(args: {
  jellyfinDuration?: number;
  handleSeek: (seconds: number) => void;
  isLocalRemuxRef: React.MutableRefObject<boolean>;
  /** Début (absolu) RÉEL de la session remux courante (frag #tnt-start) ; borne basse du seek natif arrière. */
  sessionStartRef: React.MutableRefObject<number>;
  /** État de production du remux (poll 1 Hz, cf. useTVRemuxInfo) — null hors remux/vieux natif. */
  infoRef: React.MutableRefObject<RemuxInfo | null>;
  positionRef: React.MutableRefObject<number>;
  displayTimeRef: React.MutableRefObject<number>;
  lastDisplayUpdate: React.MutableRefObject<number>;
  lastProgressTime: React.MutableRefObject<number>;
  pausedStateRef: React.MutableRefObject<boolean>;
  softReloadRef: React.MutableRefObject<boolean>;
  setReloadFrameSec: (v: number | null) => void;
  setDisplayTime: (v: number) => void;
  notifySeekRef: React.MutableRefObject<(target: number, windowMs?: number, afterReload?: boolean) => void>;
  reportSeek: (seconds: number, paused: boolean) => void;
  setStartTicks: (v: number) => void;
  /** Garde le lecteur en pause pendant le re-remux hors-fenêtre (anti son sortant) ; dé-pause auto au onLoad. */
  holdForReload: () => void;
  /** Base des skips ±10/30 (useTVPlayerControls) : synchronisée à CHAQUE commit de seek. */
  controlsCurrentTimeRef?: React.MutableRefObject<number>;
  /** Session locale morte pendant une pause (stall) : un seek doit alors forcer
   *  le chemin re-remux (seek natif impossible sur un AVPlayer en erreur). */
  deadSessionRef?: React.MutableRefObject<boolean>;
}): (seconds: number) => void {
  const {
    jellyfinDuration, handleSeek, isLocalRemuxRef, sessionStartRef, infoRef, positionRef, displayTimeRef,
    lastDisplayUpdate, lastProgressTime, pausedStateRef, softReloadRef, setReloadFrameSec,
    setDisplayTime, notifySeekRef, reportSeek, setStartTicks, holdForReload, controlsCurrentTimeRef,
    deadSessionRef,
  } = args;

  const pendingTargetRef = useRef<number | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deferTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearDefer = useCallback(() => {
    if (deferTimerRef.current) { clearInterval(deferTimerRef.current); deferTimerRef.current = null; }
  }, []);
  useEffect(() => () => {
    clearDefer();
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, [clearDefer]);

  return useCallback((seconds: number) => {
    const dur = jellyfinDuration || 0;
    const clamped = Math.max(0, dur > 0 ? Math.min(seconds, dur) : seconds);
    if (!isLocalRemuxRef.current) { handleSeek(clamped); return; }   // non-remux → seek natif inchangé

    // Affichage optimiste commun (chemins différé/re-remux/coalesce) : position + base des skips.
    const showOptimistic = () => {
      displayTimeRef.current = clamped; positionRef.current = clamped;
      if (controlsCurrentTimeRef) controlsCurrentTimeRef.current = clamped;
      setDisplayTime(clamped);
      lastDisplayUpdate.current = Date.now(); lastProgressTime.current = Date.now();
    };
    // Re-remux différé/cumulé à la cible finale (UN SEUL déclencheur : setStartTicks bust la clé remux).
    const scheduleRemux = () => {
      pendingTargetRef.current = clamped;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const target = pendingTargetRef.current;
        pendingTargetRef.current = null;
        if (target == null) return;
        Remux?.prepareResume?.();                     // force une session fraîche à la cible (saute withinAvail)
        softReloadRef.current = true;
        holdForReload();                              // lecteur en pause pendant le reload (anti son sortant)
        setReloadFrameSec(target);                    // vignette trickplay de la destination
        notifySeekRef.current(target, 8000, true);    // gate de convergence post-reload
        reportSeek(target, pausedStateRef.current);
        setStartTicks(Math.floor(target * TICKS_PER_SECOND));
      }, SEEK_DEBOUNCE_MS);
    };

    // 1. Re-remux en attente → TOUJOURS coalescer (jamais le fast-path pendant un pending).
    if (pendingTargetRef.current != null) {
      showOptimistic();
      notifySeekRef.current(clamped, SEEK_DEBOUNCE_MS + 1700, false);
      scheduleRemux();
      return;
    }
    // Nouvelle cible pendant un seek différé → on repart de l'évaluation complète.
    clearDefer();

    const dead = deadSessionRef?.current === true;
    const pos = positionRef.current;
    const info = infoRef.current;
    const sessionStart = info ? info.sessionStartSec : sessionStartRef.current;
    // Fin d'écrit ABSOLUE ; sans info (vieux natif/poll pas encore passé), comportement
    // historique : la fenêtre +295 fait foi.
    const writtenAbs = info ? info.sessionStartSec + info.writtenSec : Number.POSITIVE_INFINITY;
    const lower = Math.max(sessionStart, pos - 55);
    const upperNative = Math.min(writtenAbs - WRITTEN_MARGIN_SEC, pos + 295);

    // 2. Dans la fenêtre ÉCRITE → seek natif immédiat (réutilise la session).
    if (!dead && clamped >= lower && clamped <= upperNative) {
      handleSeek(clamped);
      if (controlsCurrentTimeRef) controlsCurrentTimeRef.current = clamped;
      return;
    }

    // 3. Devant l'écrit mais dans la fenêtre de pacing → seek natif DIFFÉRÉ (dès que produit).
    if (!dead && info && !info.done && clamped > upperNative && clamped <= pos + 295 && clamped >= lower) {
      showOptimistic();
      notifySeekRef.current(clamped, DEFER_TIMEOUT_MS + 1500, false);
      const deadline = Date.now() + DEFER_TIMEOUT_MS;
      deferTimerRef.current = setInterval(() => {
        const cur = infoRef.current;
        const curWritten = cur ? cur.sessionStartSec + cur.writtenSec : Number.NEGATIVE_INFINITY;
        if (cur && (curWritten >= clamped + 0.5 || cur.done)) {
          clearDefer();
          handleSeek(clamped);
          if (controlsCurrentTimeRef) controlsCurrentTimeRef.current = clamped;
          return;
        }
        if (Date.now() >= deadline) {   // production trop lente (cap disque…) → repli re-remux
          clearDefer();
          notifySeekRef.current(clamped, SEEK_DEBOUNCE_MS + 1700, false);
          scheduleRemux();
        }
      }, DEFER_POLL_MS);
      return;
    }

    // Clear SYNCHRONE : la nouvelle session ranime le flux — l'effet d'unpause
    // (useTVRemuxPause) ne doit pas lancer un 2ᵉ re-remux à l'ancienne position.
    if (dead) deadSessionRef!.current = false;

    // 4. HORS fenêtre → re-remux. Gate armé IMMÉDIATEMENT (anti-rollback pendant le debounce).
    showOptimistic();
    notifySeekRef.current(clamped, SEEK_DEBOUNCE_MS + 1700, false);
    scheduleRemux();
  }, [jellyfinDuration, handleSeek, reportSeek, holdForReload, clearDefer]); // eslint-disable-line react-hooks/exhaustive-deps
}
