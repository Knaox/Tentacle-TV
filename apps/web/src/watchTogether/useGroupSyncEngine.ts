import { useCallback, useEffect, useRef } from "react";
import { sampleClock, subscribeSocket } from "@tentacle-tv/api-client";
import {
  TICKS_PER_SECOND, WT_CLOCK_BURST_COUNT, WT_CLOCK_BURST_SPACING_MS,
  WT_SEEK_LOOKAHEAD_S, wtPositionSecondsAt, type SegmentType,
} from "@tentacle-tv/shared";
import { useWatchTogether } from "./WatchTogetherProvider";
import type { PlayerTransportRef } from "./playerTransport";
import {
  armEcho, isApplying, isWaitedForMe, setTransportRate,
  REMOTE_JUMP_THRESHOLD_S, type GroupSyncSharedRefs,
} from "./groupSyncShared";
import { useGroupDriftLoop } from "./useGroupDriftLoop";
import { wtLog } from "./wtLog";

/**
 * Watch Together — moteur de synchronisation d'un player monté.
 * Applique l'état canonique du serveur au player local (pause/lecture, seeks
 * distants — la correction de drift vit dans useGroupDriftLoop) et transforme
 * les transitions locales observées en intents `wt:*` (modèle optimiste : le
 * player agit, le moteur rapporte). Anti-écho par fenêtre temporelle +
 * comparaison d'état.
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
  const selfIdRef = useRef(selfId);
  selfIdRef.current = selfId;

  const applyingUntilRef = useRef(0);
  const lastBufferingSentRef = useRef<boolean | null>(null);
  const softCorrectionSinceRef = useRef<number | null>(null);
  const currentRateRef = useRef(1);
  /** Dernier état de lecture appliqué — détection des seeks distants (sauts). */
  const appliedSnapshotRef = useRef<{ positionTicks: number; stateAtServerTime: number; paused: boolean } | null>(null);

  // Bundle stable des refs partagées avec la boucle de drift.
  const shared = useRef<GroupSyncSharedRefs>({
    roomRef, serverNowRef, selfIdRef,
    applyingUntilRef, lastBufferingSentRef, softCorrectionSinceRef, currentRateRef,
  }).current;

  // ── Session : rafale d'horloge + nettoyage au démontage ──
  useEffect(() => {
    if (!active || !itemId) return;
    wtLog("engine", "session ON", { itemId });

    // Rafale d'échantillonnage d'horloge (médiane implicite : meilleur RTT retenu).
    let burst = 0;
    const burstTimer = setInterval(() => {
      sampleClock();
      if (++burst >= WT_CLOCK_BURST_COUNT) clearInterval(burstTimer);
    }, WT_CLOCK_BURST_SPACING_MS);

    return () => {
      clearInterval(burstTimer);
      wtLog("engine", "session OFF — presence false + vitesse 1×", { itemId });
      // Ne JAMAIS laisser un rattrapage doux (0.95/1.05) actif après un
      // leave/démontage : hors groupe, personne ne remettrait la vitesse à 1.
      if (currentRateRef.current !== 1) {
        currentRateRef.current = 1;
        transportRef.current?.setRate(1);
      }
      sendRef.current({ type: "wt:presence", inPlayback: false });
      lastBufferingSentRef.current = null;
      softCorrectionSinceRef.current = null;
      appliedSnapshotRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      wtLog("engine", "déclaration : wt:setItem (lancer ce média pour le groupe)", {
        itemId, fromItemId: r!.itemId, startS: claimStartSeconds,
      });
      sendRef.current({
        type: "wt:setItem",
        itemId,
        fromItemId: r!.itemId,
        reason: "manual",
        startPositionTicks: Math.max(0, Math.round((claimStartSeconds ?? 0) * TICKS_PER_SECOND)),
      });
    }
    sendRef.current({ type: "wt:presence", inPlayback: true, itemId });
    // Départ gelé : le groupe m'attend le temps que mon player charge. MAIS si
    // le player est DÉJÀ prêt (groupe créé/rejoint pendant une lecture en
    // cours), déclarer un buffering serait un gel que RIEN ne résoudrait :
    // mediaReady ne re-flippe pas → buffering:false jamais émis → groupe gelé
    // jusqu'au timeout serveur et boucle de drift locale morte (état « cassé
    // jusqu'au hard refresh »).
    const alreadyReady = transportRef.current?.isMediaReady?.() === true;
    wtLog("engine", `déclaration : presence inPlayback + wt:buffering ${!alreadyReady}`, {
      itemId, alreadyReady, claimed: needsClaim,
    });
    sendRef.current({ type: "wt:buffering", buffering: !alreadyReady });
    lastBufferingSentRef.current = !alreadyReady;
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

    // Group-wait dont JE suis la cause (mon player charge/bufferise) OU
    // (re)chargement local déclaré encore en cours (rebuild qualité pendant
    // une pause utilisateur p.ex. — la room n'est alors PAS en pauseReason
    // buffering) : ne m'appliquer NI pause NI seek — mpv pausé/seeké pendant
    // un loadfile ne décode pas la première frame (écran noir) et ne
    // signalerait jamais « prêt ». La boucle de drift réconciliera pause et
    // position dès que le player aura signalé « prêt ».
    const waitedForMe = isWaitedForMe(room, selfId);
    const loadingSelf = lastBufferingSentRef.current === true;
    const skipApply = waitedForMe || loadingSelf;

    wtLog("engine", `état reçu epoch=${room.epoch}`, {
      paused: room.paused, reason: room.pauseReason,
      roomPosS: (room.positionTicks / TICKS_PER_SECOND).toFixed(1),
      waiting: room.waitingForUserIds.length, waitedForMe, loadingSelf,
      playerPaused: t.isPaused(), playerPosS: t.getPositionSeconds().toFixed(1),
    });

    if (room.paused !== t.isPaused() && !skipApply) {
      armEcho(shared);
      if (room.paused) { wtLog("engine", "apply: pause distante"); t.pause(); }
      else { wtLog("engine", "apply: lecture distante"); t.play(); }
    }

    // Saut de position entre l'ancien et le nouvel état = seek distant → recalage
    // immédiat (la correction douce est réservée à la dérive progressive).
    if (prev) {
      const expectedFromPrev = wtPositionSecondsAt(prev, nowSrv);
      const expectedNew = wtPositionSecondsAt(room, nowSrv);
      if (Math.abs(expectedNew - expectedFromPrev) > REMOTE_JUMP_THRESHOLD_S) {
        if (skipApply) {
          wtLog("engine", "apply: seek distant IGNORÉ (player en (re)chargement — il vise déjà la bonne position)", { toS: expectedNew.toFixed(1) });
        } else {
          wtLog("engine", "apply: seek distant", { fromS: expectedFromPrev.toFixed(1), toS: expectedNew.toFixed(1) });
          armEcho(shared);
          t.seekTo(expectedNew + (room.paused ? 0 : WT_SEEK_LOOKAHEAD_S));
          setTransportRate(shared, t, 1);
          softCorrectionSinceRef.current = null;
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onGroupItem, room?.epoch]);

  // ── Événements transients : dismiss auto-next d'un autre membre ──
  useEffect(() => {
    if (!onGroupItem) return;
    return subscribeSocket((msg) => {
      if (msg.type === "wt:autonextDismiss" && msg.originUserId !== selfId) {
        wtLog("engine", "auto-next dismiss distant", { from: msg.originUserId });
        transportRef.current?.cancelAutoNext?.();
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onGroupItem, selfId]);

  // ── Boucle de drift (1 Hz) ──
  useGroupDriftLoop({ enabled: !!onGroupItem, itemId, transportRef, shared });

  // ── Intents locaux (observe & report) ──

  const posTicks = useCallback(() => {
    const s = transportRef.current?.getPositionSeconds() ?? 0;
    return Math.max(0, Math.round(s * TICKS_PER_SECOND));
  }, [transportRef]);

  const notifyPlayState = useCallback((paused: boolean) => {
    const r = roomRef.current;
    if (!active || !r || r.itemId !== itemId) return;
    // (Re)chargement local en cours : les flips pause de mpv sont des artefacts
    // du loadfile (pause=false forcé avant chargement…), pas des intents — un
    // wt:play parti d'ici forcerait la reprise du group-wait et éjecterait les
    // membres encore attendus (waitingFor.clear() côté serveur).
    if (lastBufferingSentRef.current !== false) {
      wtLog("engine", `intent play/pause ignoré (player en chargement déclaré), paused=${paused}`);
      return;
    }
    if (isApplying(shared)) {
      wtLog("engine", `intent play/pause ignoré (écho d'une commande distante), paused=${paused}`);
      return;
    }
    if (r.paused === paused) return; // no-op / écho tardif
    wtLog("engine", `intent → wt:${paused ? "pause" : "play"}`, { posS: (posTicks() / TICKS_PER_SECOND).toFixed(1) });
    sendRef.current({ type: paused ? "wt:pause" : "wt:play", positionTicks: posTicks() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, itemId, posTicks]);

  const notifySeek = useCallback((seconds: number) => {
    const r = roomRef.current;
    if (!active || !r || r.itemId !== itemId) return;
    // Sauts de position pendant un (re)chargement = start-position/artefacts.
    if (lastBufferingSentRef.current !== false) {
      wtLog("engine", "intent seek ignoré (player en chargement déclaré)", { toS: seconds.toFixed(1) });
      return;
    }
    if (isApplying(shared)) {
      wtLog("engine", "intent seek ignoré (écho d'un seek distant)", { toS: seconds.toFixed(1) });
      return;
    }
    // Dédup : un seek vers la position (extrapolée) du groupe est un recalage
    // local (ex. fallback niveau 3 différé d'un seek distant), pas un intent.
    if (Math.abs(seconds - wtPositionSecondsAt(r, serverNowRef.current())) < REMOTE_JUMP_THRESHOLD_S) return;
    wtLog("engine", "intent → wt:seek", { toS: seconds.toFixed(1) });
    sendRef.current({ type: "wt:seek", positionTicks: Math.max(0, Math.round(seconds * TICKS_PER_SECOND)) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, itemId]);

  const notifyBuffering = useCallback((buffering: boolean) => {
    const r = roomRef.current;
    if (!active || !r || r.itemId !== itemId) return;
    // Re-présence : si le serveur m'a éjecté de la lecture (timeout anti-gel
    // 60 s → playbackError, ou présence perdue), mes wt:buffering seraient
    // traités comme de simples mises à jour de statut — plus JAMAIS de
    // group-wait pour moi, le groupe ne m'attendrait plus. Se re-déclarer.
    const self = selfIdRef.current ? r.members.find((m) => m.userId === selfIdRef.current) : undefined;
    if (self && !self.inPlayback && declaredRef.current) {
      wtLog("engine", "re-présence (le serveur me croyait hors lecture)", { playbackError: self.playbackError });
      sendRef.current({ type: "wt:presence", inPlayback: true, itemId });
    }
    if (lastBufferingSentRef.current === buffering) return;
    lastBufferingSentRef.current = buffering;
    wtLog("engine", `intent → wt:buffering ${buffering}`, { posS: (posTicks() / TICKS_PER_SECOND).toFixed(1) });
    sendRef.current({ type: "wt:buffering", buffering, positionTicks: posTicks() });
  }, [active, itemId, posTicks]);

  const notifyFatalError = useCallback(() => {
    if (!active || !itemId) return;
    wtLog("engine", "intent → wt:playbackError (média illisible ici)", { itemId });
    lastBufferingSentRef.current = null; // fige la boucle de drift
    sendRef.current({ type: "wt:playbackError", itemId });
  }, [active, itemId]);

  const notifyAutoNextDismiss = useCallback(() => {
    const r = roomRef.current;
    if (!active || !r || r.itemId !== itemId) return;
    sendRef.current({ type: "wt:autonextDismiss" });
  }, [active, itemId]);

  const notifySkipIntroDismiss = useCallback((segmentType: SegmentType) => {
    const r = roomRef.current;
    if (!active || !r || r.itemId !== itemId) return;
    sendRef.current({ type: "wt:skipIntroDismiss", segmentType });
  }, [active, itemId]);

  return {
    active, onGroupItem,
    notifyPlayState, notifySeek, notifyBuffering, notifyFatalError, notifyAutoNextDismiss,
    notifySkipIntroDismiss,
  };
}
