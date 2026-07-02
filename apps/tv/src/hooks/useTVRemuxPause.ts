import { useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { NativeModules } from "react-native";
import { TICKS_PER_SECOND } from "@tentacle-tv/shared";

/**
 * Vraie pause permanente du lecteur remux on-device tvOS (anti `AVFoundationErrorDomain -11866`).
 *
 * En pause, le manifeste HLS `event` cesse de grandir → tvOS 18.x déclare le flux corrompu (~3-4 s de
 * manifeste inchangé). On pousse l'état de pause au natif : le serveur local réécrit alors `index.m3u8`
 * (snapshot VOD+ENDLIST en mode B, ou keepalive EVENT en mode A) → AVPlayer reste figé au frame, sans
 * erreur ni reprise automatique. Le point de pause est préservé.
 *
 * Reprise (mode B) : AVPlayer a mis le snapshot ENDLIST en cache → on force un remount qui re-fetch l'EVENT
 * croissant, sur une NOUVELLE session re-remuxée À LA POSITION COURANTE P (`prepareResume` + `setStartTicks`,
 * même mécanisme que `useTVRemuxSeek`) → offset=P, relatif 0 = point de pause exact.
 *
 * SPIKE : `SNAPSHOT_MODE` arbitre la stratégie de manifeste de pause (0 = keepalive, 1 = VOD) — à trancher
 * sur device « Chambre » (Q4 : VOD+ENDLIST tue-t-il vraiment le -11866 ?). Pousser le mode au natif au montage.
 */
const Remux = (NativeModules as {
  TVLocalRemux?: {
    setPaused?: (paused: boolean) => void;
    prepareResume?: () => void;
    setSnapshotMode?: (mode: number) => void;
  };
}).TVLocalRemux;

// 0 = keepalive EVENT (variante A) · 1 = VOD+ENDLIST (variante B).
// MODE A retenu (itération 3) : le keepalive garde la session EVENT vivante en pause → au resume il suffit de
// DÉ-PAUSER (pas de reload, pas de re-remux) → « session encore valable → pas de rechargement ». À confirmer
// sur device que le keepalive tue bien le -11866 (sinon repli mode B + remount à la position relative courante).
const SNAPSHOT_MODE: number = 0;
// Délai avant d'engager le manifeste de pause : > pause de scrub mais < seuil de corruption AVPlayer (~3-4 s).
const ENGAGE_MS = 1200;

export function useTVRemuxPause(args: {
  paused: boolean;
  isLocalRemux: boolean;
  positionRef: MutableRefObject<number>;
  softReloadRef: MutableRefObject<boolean>;
  setReloadFrameSec: (s: number | null) => void;
  setReloadNonce: Dispatch<SetStateAction<number>>;
  setStartTicks: Dispatch<SetStateAction<number>>;
  /** Garde le lecteur en pause pendant le reload (anti son sortant) ; dé-pause auto au onLoad. */
  holdForReload: () => void;
  notifySeekRef: MutableRefObject<(target: number, windowMs?: number, afterReload?: boolean) => void>;
  resetLoadedRef: MutableRefObject<() => void>;
  /** Session locale morte pendant la pause (stall -11866 malgré le keepalive,
   *  cf. useTVRemuxStallRecovery) : la reprise doit alors remonter une session
   *  fraîche à P (chemin mode B) même en mode keepalive. */
  deadSessionRef: MutableRefObject<boolean>;
}) {
  const { paused, isLocalRemux, positionRef, softReloadRef, setReloadFrameSec, setReloadNonce, setStartTicks, holdForReload, notifySeekRef, resetLoadedRef, deadSessionRef } = args;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const engagedRef = useRef(false);

  useEffect(() => { Remux?.setSnapshotMode?.(SNAPSHOT_MODE); }, []);

  useEffect(() => {
    if (!isLocalRemux) return;
    if (paused) {
      // Engager APRÈS un délai → les pauses courtes (scrub) restent en EVENT pur, zéro remount à la reprise.
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => { Remux?.setPaused?.(true); engagedRef.current = true; }, ENGAGE_MS);
      return;
    }
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    // Session morte pendant la pause (stall malgré le keepalive) : la reprise
    // DOIT remonter une session fraîche à P, même en mode keepalive et même si
    // la pause n'avait pas été engagée.
    const dead = deadSessionRef.current;
    if (!engagedRef.current && !dead) return;   // pause courte jamais engagée → reprise transparente
    engagedRef.current = false;
    Remux?.setPaused?.(false);
    if (SNAPSHOT_MODE !== 1 && !dead) return;   // mode keepalive, session vivante : rien à recharger
    deadSessionRef.current = false;
    // Mode VOD : remount sur une nouvelle session re-remuxée à P (point de pause exact préservé). On arme
    // SYNCHRONIQUEMENT, AVANT le reload async :
    //  - holdForReload() : isLoading=true (spinner + garde l'image figée) ET reloadHold=true → le LECTEUR
    //    reste en pause pendant tout le reload (AUCUN son/image de la session sortante, ni « recommence
    //    instant »). Dé-pause auto au onLoad de la nouvelle session (PlayerScreen). Remplace le mute.
    //  - resetLoaded() : loadedRef=false → le gate afterReload de handleProgress reste FERMÉ jusqu'au onLoad.
    //  - notifySeek(P, afterReload) : les onProgress de la session stale sont ignorés tant que non convergé.
    const p = positionRef.current;
    Remux?.prepareResume?.();
    softReloadRef.current = true;
    holdForReload();
    resetLoadedRef.current();
    setReloadFrameSec(p);
    notifySeekRef.current(p, 8000, true);
    setStartTicks(Math.floor(p * TICKS_PER_SECOND));
    setReloadNonce((n) => n + 1);
  }, [paused, isLocalRemux]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    Remux?.setPaused?.(false);
  }, []);
}
