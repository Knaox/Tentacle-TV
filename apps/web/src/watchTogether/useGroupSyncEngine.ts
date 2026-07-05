import { useCallback, useEffect, useRef } from "react";
import { sampleClock, subscribeSocket } from "@tentacle-tv/api-client";
import {
  TICKS_PER_SECOND, WT_CLOCK_BURST_COUNT, WT_CLOCK_BURST_SPACING_MS, WT_DRIFT_HARD_S,
  WT_DRIFT_LOOP_MS, WT_DRIFT_PAUSED_S, WT_DRIFT_SETTLED_S, WT_DRIFT_SOFT_S,
  WT_RATE_CATCHUP, WT_RATE_SLOWDOWN, WT_SEEK_LOOKAHEAD_S, WT_SOFT_CORRECTION_TIMEOUT_MS,
  wtPositionSecondsAt,
} from "@tentacle-tv/shared";
import { useWatchTogether } from "./WatchTogetherProvider";
import type { PlayerTransportRef } from "./playerTransport";

/** Fenêtre pendant laquelle les événements player locaux sont considérés comme
 *  l'écho d'une commande distante que le moteur vient d'appliquer. */
const APPLY_ECHO_WINDOW_MS = 400;
/** Saut de position entre deux états serveur interprété comme un seek distant. */
const REMOTE_JUMP_THRESHOLD_S = 1;

/**
 * Watch Together — moteur de synchronisation d'un player monté.
 * Applique l'état canonique du serveur au player local (pause/lecture, seeks
 * distants, correction de drift douce/dure) et transforme les transitions
 * locales observées en intents `wt:*` (modèle optimiste : le player agit,
 * le moteur rapporte). Anti-écho par fenêtre temporelle + comparaison d'état.
 */
export function useGroupSyncEngine({
  itemId,
  transportRef,
  claimStartSeconds,
}: {
  itemId: string | undefined;
  transportRef: PlayerTransportRef;
  /** Position initiale à revendiquer si CE montage lance le média pour le
   *  groupe (reprise Jellyfin du lanceur) — undefined tant qu'elle n'est pas
   *  connue : le `wt:setItem` est différé jusque-là. */
  claimStartSeconds?: number;
}) {
  const { room, send, serverNow, isInGroup, selfId } = useWatchTogether();
  const active = isInGroup && !!itemId;
  const onGroupItem = active && room?.itemId === itemId;

  const roomRef = useRef(room);
  roomRef.current = room;
  const serverNowRef = useRef(serverNow);
  serverNowRef.current = serverNow;
  const sendRef = useRef(send);
  sendRef.current = send;

  const applyingUntilRef = useRef(0);
  const lastBufferingSentRef = useRef<boolean | null>(null);
  const softCorrectionSinceRef = useRef<number | null>(null);
  const currentRateRef = useRef(1);
  /** Dernier état de lecture appliqué — détection des seeks distants (sauts). */
  const appliedSnapshotRef = useRef<{ positionTicks: number; stateAtServerTime: number; paused: boolean } | null>(null);

  const applying = () => Date.now() < applyingUntilRef.current;
  const armEcho = () => { applyingUntilRef.current = Date.now() + APPLY_ECHO_WINDOW_MS; };

  const setRate = useCallback((rate: number) => {
    if (currentRateRef.current === rate) return;
    currentRateRef.current = rate;
    transportRef.current?.setRate(rate);
  }, [transportRef]);

  // ── Session : rafale d'horloge + nettoyage au démontage ──
  useEffect(() => {
    if (!active || !itemId) return;

    // Rafale d'échantillonnage d'horloge (médiane implicite : meilleur RTT retenu).
    let burst = 0;
    const burstTimer = setInterval(() => {
      sampleClock();
      if (++burst >= WT_CLOCK_BURST_COUNT) clearInterval(burstTimer);
    }, WT_CLOCK_BURST_SPACING_MS);

    return () => {
      clearInterval(burstTimer);
      sendRef.current({ type: "wt:presence", inPlayback: false });
      lastBufferingSentRef.current = null;
      softCorrectionSinceRef.current = null;
      appliedSnapshotRef.current = null;
      currentRateRef.current = 1;
    };
  }, [active, itemId]);

  // ── Déclaration : setItem filet + presence + buffering (une fois par montage) ──
  const declaredRef = useRef(false);
  useEffect(() => { declaredRef.current = false; }, [itemId]);
  useEffect(() => {
    if (!active || !itemId || declaredRef.current) return;
    const r = roomRef.current;
    const needsClaim = !!r && r.itemId !== itemId;
    // Lancement d'un média : attendre de connaître la position de reprise du
    // lanceur (item chargé) pour que le groupe démarre là où IL en était.
    if (needsClaim && claimStartSeconds === undefined) return;
    declaredRef.current = true;
    if (needsClaim) {
      // Filet générique : arriver sur un player avec un autre média = le lancer
      // pour le groupe (premier arrivé gagne, dédup serveur par fromItemId).
      sendRef.current({
        type: "wt:setItem",
        itemId,
        fromItemId: r!.itemId,
        reason: "manual",
        startPositionTicks: Math.max(0, Math.round((claimStartSeconds ?? 0) * TICKS_PER_SECOND)),
      });
    }
    sendRef.current({ type: "wt:presence", inPlayback: true, itemId });
    // Départ gelé : le groupe m'attend le temps que mon player charge.
    sendRef.current({ type: "wt:buffering", buffering: true });
    lastBufferingSentRef.current = true;
  }, [active, itemId, claimStartSeconds]);

  // ── Application des états distants (pause/lecture + seeks détectés) ──
  useEffect(() => {
    if (!onGroupItem || !room) return;
    const t = transportRef.current;
    if (!t) return;

    const nowSrv = serverNowRef.current();
    const prev = appliedSnapshotRef.current;
    appliedSnapshotRef.current = {
      positionTicks: room.positionTicks,
      stateAtServerTime: room.stateAtServerTime,
      paused: room.paused,
    };

    // Group-wait dont JE suis la cause (mon player charge/bufferise) : ne pas
    // m'appliquer la pause — mpv pausé pendant un loadfile ne décode pas la
    // première frame (écran noir) et ne signalerait jamais « prêt ».
    const waitedForMe = room.paused && room.pauseReason === "buffering"
      && !!selfId && room.waitingForUserIds.includes(selfId);

    if (room.paused !== t.isPaused() && !waitedForMe) {
      armEcho();
      if (room.paused) t.pause();
      else t.play();
    }

    // Saut de position entre l'ancien et le nouvel état = seek distant → recalage
    // immédiat (la correction douce est réservée à la dérive progressive).
    if (prev) {
      const expectedFromPrev = wtPositionSecondsAt(prev, nowSrv);
      const expectedNew = wtPositionSecondsAt(room, nowSrv);
      if (Math.abs(expectedNew - expectedFromPrev) > REMOTE_JUMP_THRESHOLD_S) {
        armEcho();
        t.seekTo(expectedNew + (room.paused ? 0 : WT_SEEK_LOOKAHEAD_S));
        setRate(1);
        softCorrectionSinceRef.current = null;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onGroupItem, room?.epoch]);

  // ── Événements transients : dismiss auto-next d'un autre membre ──
  useEffect(() => {
    if (!onGroupItem) return;
    return subscribeSocket((msg) => {
      if (msg.type === "wt:autonextDismiss" && msg.originUserId !== selfId) {
        transportRef.current?.cancelAutoNext?.();
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onGroupItem, selfId]);

  // ── Boucle de drift (1 Hz) ──
  useEffect(() => {
    if (!onGroupItem) return;
    const loop = setInterval(() => {
      const t = transportRef.current;
      const r = roomRef.current;
      // Pas de correction tant que le player n'a pas été prêt une première fois
      // (chargement initial : le group-wait nous couvre).
      if (!t || !r || r.itemId !== itemId || lastBufferingSentRef.current !== false) return;

      const expected = wtPositionSecondsAt(r, serverNowRef.current());
      const pos = t.getPositionSeconds();

      // Réconciliation pause/lecture (rattrape un play() refusé par la policy…).
      if (t.isPaused() !== r.paused) {
        armEcho();
        if (r.paused) t.pause();
        else t.play();
      }

      if (r.paused) {
        setRate(1);
        softCorrectionSinceRef.current = null;
        if (Math.abs(pos - expected) > WT_DRIFT_PAUSED_S) {
          armEcho();
          t.seekTo(expected);
        }
        return;
      }

      const drift = pos - expected; // > 0 : en avance sur le groupe
      const abs = Math.abs(drift);

      if (abs >= WT_DRIFT_HARD_S) {
        armEcho();
        t.seekTo(expected + WT_SEEK_LOOKAHEAD_S);
        setRate(1);
        softCorrectionSinceRef.current = null;
        return;
      }
      if (abs >= WT_DRIFT_SOFT_S) {
        if (softCorrectionSinceRef.current === null) {
          softCorrectionSinceRef.current = Date.now();
        } else if (Date.now() - softCorrectionSinceRef.current > WT_SOFT_CORRECTION_TIMEOUT_MS) {
          // Rattrapage doux inefficace → recalage dur.
          armEcho();
          t.seekTo(expected + WT_SEEK_LOOKAHEAD_S);
          setRate(1);
          softCorrectionSinceRef.current = null;
          return;
        }
        setRate(drift > 0 ? WT_RATE_SLOWDOWN : WT_RATE_CATCHUP);
        return;
      }
      if (abs <= WT_DRIFT_SETTLED_S && currentRateRef.current !== 1) {
        setRate(1);
        softCorrectionSinceRef.current = null;
      }
    }, WT_DRIFT_LOOP_MS);
    return () => clearInterval(loop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onGroupItem, itemId]);

  // ── Intents locaux (observe & report) ──

  const posTicks = useCallback(() => {
    const s = transportRef.current?.getPositionSeconds() ?? 0;
    return Math.max(0, Math.round(s * TICKS_PER_SECOND));
  }, [transportRef]);

  const notifyPlayState = useCallback((paused: boolean) => {
    const r = roomRef.current;
    if (!active || !r || r.itemId !== itemId || applying()) return;
    if (r.paused === paused) return; // no-op / écho tardif
    sendRef.current({ type: paused ? "wt:pause" : "wt:play", positionTicks: posTicks() });
  }, [active, itemId, posTicks]);

  const notifySeek = useCallback((seconds: number) => {
    const r = roomRef.current;
    if (!active || !r || r.itemId !== itemId || applying()) return;
    // Dédup : un seek vers la position (extrapolée) du groupe est un recalage
    // local (ex. fallback niveau 3 différé d'un seek distant), pas un intent.
    if (Math.abs(seconds - wtPositionSecondsAt(r, serverNowRef.current())) < REMOTE_JUMP_THRESHOLD_S) return;
    sendRef.current({ type: "wt:seek", positionTicks: Math.max(0, Math.round(seconds * TICKS_PER_SECOND)) });
  }, [active, itemId]);

  const notifyBuffering = useCallback((buffering: boolean) => {
    const r = roomRef.current;
    if (!active || !r || r.itemId !== itemId) return;
    if (lastBufferingSentRef.current === buffering) return;
    lastBufferingSentRef.current = buffering;
    sendRef.current({ type: "wt:buffering", buffering, positionTicks: posTicks() });
  }, [active, itemId, posTicks]);

  const notifyFatalError = useCallback(() => {
    if (!active || !itemId) return;
    lastBufferingSentRef.current = null; // fige la boucle de drift
    sendRef.current({ type: "wt:playbackError", itemId });
  }, [active, itemId]);

  const notifyAutoNextDismiss = useCallback(() => {
    const r = roomRef.current;
    if (!active || !r || r.itemId !== itemId) return;
    sendRef.current({ type: "wt:autonextDismiss" });
  }, [active, itemId]);

  return {
    active, onGroupItem,
    notifyPlayState, notifySeek, notifyBuffering, notifyFatalError, notifyAutoNextDismiss,
  };
}
