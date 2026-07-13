import { useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { NativeModules } from "react-native";
import { TICKS_PER_SECOND } from "@tentacle-tv/shared";
import type { RemuxInfo } from "./useTVRemuxInfo";

/**
 * Vraie pause permanente du lecteur remux on-device tvOS (anti `AVFoundationErrorDomain -11866`).
 *
 * En pause, le manifeste HLS `event` cesse de grandir dès que le producteur s'est garé
 * (~300 s d'avance produites) → tvOS 18.x déclare le flux corrompu (~3-4 s de manifeste
 * inchangé). Stratégie HYBRIDE à deux étages, poussée au natif (le serveur local réécrit
 * `index.m3u8` pendant la pause, cf. TVBuildPausedManifest) :
 *
 *  - Étage 1 (ENGAGE_MS → VOD_AFTER_MS) : keepalive EVENT (mode 0). Le manifeste brut
 *    continue de grandir (remplissage de l'avance) + commentaire changeant : risque nul,
 *    et la reprise est une simple DÉ-PAUSE (instantanée, aucun reload).
 *  - Étage 2 (> VOD_AFTER_MS) : snapshot VOD+ENDLIST (mode 1). AVPlayer cesse de poller
 *    le manifeste → le -11866 devient IMPOSSIBLE pendant la pause, quelle que soit sa durée
 *    (le keepalive seul était un pari non garanti par tvOS sur les pauses longues).
 *
 * RÈGLE INVARIANTE : un item AVPlayer qui a VU un ENDLIST ne se dé-pause JAMAIS nûment —
 * il croit le flux terminé (lecture du reliquat puis FAUX onEnd). La reprise après
 * l'étage 2 force donc un remount sur une session fraîche re-remuxée à la position P
 * (`prepareResume` + `setStartTicks`, même mécanisme que `useTVRemuxSeek`).
 * Exception `trulyDone` : remux RÉELLEMENT terminé sans erreur → l'ENDLIST est authentique,
 * la dé-pause nue suffit (un remount serait un spinner gratuit en fin de film).
 */
const Remux = (NativeModules as {
  TVLocalRemux?: {
    setPaused?: (paused: boolean) => void;
    prepareResume?: () => void;
    setSnapshotMode?: (mode: number) => void;
  };
}).TVLocalRemux;

/** Délai avant d'engager la pause native : > pause de scrub mais < seuil de corruption AVPlayer (~3-4 s). */
const ENGAGE_MS = 1200;
/** Bascule keepalive → snapshot VOD : au-delà, le producteur garé ne fait plus grandir le
 *  manifeste et le keepalive seul ne suffit plus — l'ENDLIST, lui, est déterministe. */
const VOD_AFTER_MS = 20000;

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
   *  fraîche à P même si l'étage VOD n'était pas engagé. */
  deadSessionRef: MutableRefObject<boolean>;
  /** Capture la frame AFFICHÉE au moment où la pause s'engage (la vidéo est
   *  encore intacte à l'écran) → si la session meurt plus tard, l'image figée
   *  est la VRAIE dernière image au lieu de la vignette trickplay. */
  capturePauseFrame?: () => void;
  /** État de production du remux (poll 1 Hz) : détecte l'ENDLIST authentique
   *  (remux terminé) → la reprise après snapshot VOD reste une dé-pause nue. */
  infoRef?: MutableRefObject<RemuxInfo | null>;
}) {
  const { paused, isLocalRemux, positionRef, softReloadRef, setReloadFrameSec, setReloadNonce, setStartTicks, holdForReload, notifySeekRef, resetLoadedRef, deadSessionRef, capturePauseFrame, infoRef } = args;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const vodTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const engagedRef = useRef(false);
  /** L'étage 2 a servi un snapshot VOD+ENDLIST pendant CETTE pause → la reprise doit remonter.
   *  Volontairement LOCAL au hook : un re-remux monté pendant la pause (seek/changement de
   *  piste) est lui aussi servi en snapshot → son item reste « empoisonné » et le remount de
   *  reprise reste dû (double remount rare et accepté — ne PAS effacer ce flag ailleurs). */
  const vodEngagedRef = useRef(false);

  useEffect(() => { Remux?.setSnapshotMode?.(0); }, []);

  useEffect(() => {
    if (!isLocalRemux) return;
    if (paused) {
      // Engager APRÈS un délai → les pauses courtes (scrub) restent en EVENT pur, zéro remount à la reprise.
      if (timerRef.current) clearTimeout(timerRef.current);
      if (vodTimerRef.current) clearTimeout(vodTimerRef.current);
      timerRef.current = setTimeout(() => {
        capturePauseFrame?.();   // frame encore affichée (aucun stall possible avant l'engage)
        Remux?.setPaused?.(true);
        engagedRef.current = true;
        vodTimerRef.current = setTimeout(() => {
          Remux?.setSnapshotMode?.(1);   // étage 2 : snapshot VOD+ENDLIST servi → AVPlayer arrête de poller
          vodEngagedRef.current = true;
        }, VOD_AFTER_MS);
      }, ENGAGE_MS);
      return;
    }
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (vodTimerRef.current) { clearTimeout(vodTimerRef.current); vodTimerRef.current = null; }
    // Session morte pendant la pause (stall malgré le keepalive) : la reprise
    // DOIT remonter une session fraîche à P, même si la pause n'avait pas été engagée.
    const dead = deadSessionRef.current;
    const sawEndlist = vodEngagedRef.current;
    vodEngagedRef.current = false;
    if (!engagedRef.current && !dead) return;   // pause courte jamais engagée → reprise transparente
    engagedRef.current = false;
    Remux?.setPaused?.(false);
    if (sawEndlist) Remux?.setSnapshotMode?.(0);   // mode keepalive rétabli pour la PROCHAINE pause
    // ENDLIST AUTHENTIQUE (remux terminé sans erreur) : le snapshot ≡ le VOD réel — l'item
    // n'est pas « empoisonné », la dé-pause nue suffit.
    const info = infoRef?.current;
    const trulyDone = !!(info && info.done && !info.error);
    if (!dead && (!sawEndlist || trulyDone)) return;   // étage 1 seul (ou ENDLIST réel) : rien à recharger
    deadSessionRef.current = false;
    // Remount sur une nouvelle session re-remuxée à P (point de pause exact préservé). On arme
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
    if (vodTimerRef.current) clearTimeout(vodTimerRef.current);
    Remux?.setPaused?.(false);
    Remux?.setSnapshotMode?.(0);
  }, []);
}
