import { useCallback, useRef } from "react";
import { NativeModules } from "react-native";
import { TICKS_PER_SECOND } from "@tentacle-tv/shared";

const Remux = (NativeModules as { TVLocalRemux?: { prepareResume?: () => void } }).TVLocalRemux;

/** Fenêtre de regroupement des appuis rapides : un spam +30/+30/+30 = UN seul re-remux à la cible finale. */
const SEEK_DEBOUNCE_MS = 350;

/**
 * Routage du SEEK sur le lecteur REMUX local tvOS (« façon Infuse »).
 *
 * - Cible DANS la fenêtre disponible `[max(débutSession, pos−55) … pos+295]` (segments sur disque) → **seek
 *   NATIF** AVPlayer : on RÉUTILISE la session courante (instantané, zéro re-remux, zéro rechargement). C'est
 *   la clé anti-churn : un -10/+30 normal ne recrée plus de session.
 * - Cible HORS fenêtre (gros saut, arrière purgé, avant le début de session) → re-remux d'une session fraîche
 *   à la cible (`av_seek_frame`). `prepareResume()` force la session fraîche, `holdForReload()` garde le
 *   lecteur en pause pendant le reload. Debounce → appuis rapides cumulés en un seul re-remux. UN SEUL
 *   déclencheur (`setStartTicks`, qui bust déjà la clé remux) → pas de double re-remux.
 *
 * Android / direct play / transcode natif (`isLocalRemuxRef=false`) : seek natif direct INCHANGÉ.
 */
export function useTVRemuxSeek(args: {
  jellyfinDuration?: number;
  handleSeek: (seconds: number) => void;
  isLocalRemuxRef: React.MutableRefObject<boolean>;
  /** Début (absolu) de la session remux courante = `startSeconds` ; borne basse du seek natif arrière. */
  sessionStartRef: React.MutableRefObject<number>;
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
}): (seconds: number) => void {
  const {
    jellyfinDuration, handleSeek, isLocalRemuxRef, sessionStartRef, positionRef, displayTimeRef,
    lastDisplayUpdate, lastProgressTime, pausedStateRef, softReloadRef, setReloadFrameSec,
    setDisplayTime, notifySeekRef, reportSeek, setStartTicks, holdForReload,
  } = args;

  const pendingTargetRef = useRef<number | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  return useCallback((seconds: number) => {
    const dur = jellyfinDuration || 0;
    const clamped = Math.max(0, dur > 0 ? Math.min(seconds, dur) : seconds);
    if (!isLocalRemuxRef.current) { handleSeek(clamped); return; }   // non-remux → seek natif inchangé

    // Fenêtre disponible : ~60s derrière (purge TVLR_BEHIND_SEC) mais jamais avant le début de session
    // (relatif 0), ~300s devant (pacing). Dans la fenêtre → seek NATIF (réutilise la session).
    const pos = positionRef.current;
    const lower = Math.max(sessionStartRef.current, pos - 55);
    if (clamped >= lower && clamped <= pos + 295) {
      handleSeek(clamped);
      return;
    }

    // HORS fenêtre → re-remux (affichage optimiste immédiat + re-remux différé/cumulé à la cible finale).
    displayTimeRef.current = clamped; positionRef.current = clamped;
    setDisplayTime(clamped);
    lastDisplayUpdate.current = Date.now(); lastProgressTime.current = Date.now();
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
      setStartTicks(Math.floor(target * TICKS_PER_SECOND));  // UN SEUL déclencheur (bust la clé remux)
    }, SEEK_DEBOUNCE_MS);
  }, [jellyfinDuration, handleSeek, reportSeek, holdForReload]); // eslint-disable-line react-hooks/exhaustive-deps
}
