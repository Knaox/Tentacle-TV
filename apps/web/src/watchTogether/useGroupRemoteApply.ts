import { useEffect, useRef } from "react";
import { subscribeSocket } from "@tentacle-tv/api-client";
import {
  TICKS_PER_SECOND, WT_BARRIER_CONFIRM_TIMEOUT_MS, WT_BARRIER_PRESEEK_MPV_S, WT_PRESEEK_TOLERANCE_S,
  WT_SCHEDULED_PLAY_SETTLE_MS, wtPositionSecondsAt, type WtRoomStateDto,
} from "@tentacle-tv/shared";
import type { PlayerTransportRef } from "./playerTransport";
import {
  armEcho, cancelScheduledPlay, clearPendingIntent, isBarrierParticipant, seekLookaheadS, sendBarrierReady,
  setTransportRate, REMOTE_JUMP_THRESHOLD_S, type GroupSyncSharedRefs, type ScheduledPlay,
} from "./groupSyncShared";
import { computePlayDelayMs, isFutureAnchor, needsPreseek } from "./groupSchedule";
import { wtLog } from "./wtLog";

/**
 * Watch Together — application des états distants au lecteur local :
 * pause/lecture, seeks distants (sauts entre deux états), et la REPRISE
 * PLANIFIÉE — quand la salle joue depuis un instant encore à venir, le lecteur
 * se pré-cale sur la position gelée puis lance la lecture à cet instant-là,
 * un peu avant pour absorber sa propre latence de démarrage — et la BARRIÈRE :
 * quand la salle m'attend sur une cible (seek, saut, reprise), je me cale en
 * pause, j'attends d'être posé, et je confirme avec l'identifiant de la
 * barrière. La correction de dérive continue vit dans useGroupDriftLoop.
 */

/** Cadence du sondage « suis-je posé ? » pendant une barrière. */
const BARRIER_POLL_MS = 100;
/** Pendant une barrière, un lecteur qui s'est remis à jouer ou qui a quitté la
 *  cible y est ramené — au plus une fois par ce délai, le temps qu'un seek
 *  atterrisse. Le cas mesuré : un rechargement de source relance la lecture
 *  de lui-même, et sans rappel le lecteur n'était plus jamais posé — la salle
 *  attendait les vingt secondes du délai de barrière, en pause. */
const BARRIER_REALIGN_MIN_MS = 1_500;
export function useGroupRemoteApply({
  enabled,
  room,
  transportRef,
  shared,
}: {
  enabled: boolean;
  room: WtRoomStateDto | null;
  transportRef: PlayerTransportRef;
  shared: GroupSyncSharedRefs;
}) {
  /** Dernier état de lecture appliqué — détection des seeks distants (sauts). */
  const appliedSnapshotRef = useRef<{ positionTicks: number; stateAtServerTime: number; paused: boolean } | null>(null);
  /** Sondage de barrière en cours, et la dernière barrière confirmée. */
  const barrierPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const confirmedBarrierRef = useRef<number | null>(null);
  const stopBarrierPoll = () => {
    if (barrierPollRef.current) { clearInterval(barrierPollRef.current); barrierPollRef.current = null; }
  };

  useEffect(() => {
    if (!enabled || !room) return;
    const t = transportRef.current;
    if (!t) return;

    const nowSrv = shared.serverNowRef.current();
    const prev = appliedSnapshotRef.current;
    appliedSnapshotRef.current = {
      positionTicks: room.positionTicks,
      stateAtServerTime: room.stateAtServerTime,
      paused: room.paused,
    };
    // Tout nouvel état annule le play() programmé par le précédent ; si
    // l'ancre est la même (garde serveur), il est simplement reprogrammé.
    cancelScheduledPlay(shared);

    // (Re)chargement local déclaré encore en cours (mon player charge ou
    // bufferise, rebuild de source…) : ne m'appliquer NI pause NI seek — mpv
    // pausé/seeké pendant un loadfile ne décode pas la première frame (écran
    // noir) et ne signalerait jamais « prêt ». La boucle de drift réconciliera
    // pause et position dès que le player aura signalé « prêt ».
    const loadingSelf = shared.lastBufferingSentRef.current === true;
    const skipApply = loadingSelf;
    const futureAnchor = isFutureAnchor(room, nowSrv);
    const barrierForMe = !loadingSelf && isBarrierParticipant(room, shared.selfIdRef.current);

    wtLog("engine", `état reçu epoch=${room.epoch}`, {
      paused: room.paused, reason: room.pauseReason, futureAnchor, barrier: room.barrierId, barrierForMe,
      roomPosS: (room.positionTicks / TICKS_PER_SECOND).toFixed(1),
      waiting: room.waitingForUserIds.length, loadingSelf,
      playerPaused: t.isPaused(), playerPosS: t.getPositionSeconds().toFixed(1),
    });

    // ── Barrière : la salle m'attend sur la cible ──
    if (barrierForMe && room.barrierId !== undefined) {
      const barrierId = room.barrierId;
      if (confirmedBarrierRef.current !== barrierId && !barrierPollRef.current) {
        const targetS = room.positionTicks / TICKS_PER_SECOND;
        if (!t.isPaused()) { armEcho(shared); t.pause(); }
        // Pré-calage exact, en pause. Sur mpv, un seek à moins de 300 ms de la
        // cible coûte plus qu'il ne corrige (re-seek ffmpeg → cache vide → re-gel).
        const tolerance = t.precision === "coarse" ? WT_BARRIER_PRESEEK_MPV_S : WT_PRESEEK_TOLERANCE_S;
        if (Math.abs(t.getPositionSeconds() - targetS) > tolerance) {
          wtLog("engine", "barrière : pré-calage", { barrierId, fromS: t.getPositionSeconds().toFixed(2), toS: targetS.toFixed(2) });
          armEcho(shared);
          t.seekTo(targetS);
          setTransportRate(shared, t, 1);
          shared.softCorrectionSinceRef.current = null;
        }
        const startedAt = Date.now();
        let realignedAt = 0;
        barrierPollRef.current = setInterval(() => {
          const player = transportRef.current;
          const current = shared.roomRef.current;
          if (!player || !current || current.barrierId !== barrierId) { stopBarrierPoll(); return; }
          const settled = player.isSettledAt
            ? player.isSettledAt(targetS)
            : !player.isSeeking?.() && player.isMediaReady?.() !== false;
          if (!settled && Date.now() - startedAt < WT_BARRIER_CONFIRM_TIMEOUT_MS) {
            // Prêt à être jugé (pas de seek en vol, média chargé) mais pas posé :
            // en lecture, ou hors de la cible → pause et re-calage.
            const judgeable = !player.isSeeking?.() && player.isMediaReady?.() !== false;
            if (judgeable && Date.now() - realignedAt > BARRIER_REALIGN_MIN_MS) {
              const offS = Math.abs(player.getPositionSeconds() - targetS);
              if (!player.isPaused() || offS > tolerance) {
                realignedAt = Date.now();
                wtLog("engine", "barrière : le lecteur a bougé — pause et re-calage", {
                  barrierId, playing: !player.isPaused(), offS: offS.toFixed(2), toS: targetS.toFixed(2),
                });
                armEcho(shared);
                if (!player.isPaused()) player.pause();
                if (offS > tolerance) player.seekTo(targetS);
              }
            }
            return;
          }
          stopBarrierPoll();
          confirmedBarrierRef.current = barrierId;
          wtLog("engine", settled ? "barrière : posé → prêt" : "barrière : pas posé à temps → prêt quand même", {
            barrierId, posS: player.getPositionSeconds().toFixed(2), afterMs: Date.now() - startedAt,
          });
          sendBarrierReady(shared, player, barrierId);
        }, BARRIER_POLL_MS);
      }
      return;
    }
    stopBarrierPoll();

    if (room.paused !== t.isPaused() && !skipApply) {
      if (room.paused) { armEcho(shared); wtLog("engine", "apply: pause distante"); t.pause(); }
      else if (!futureAnchor) { armEcho(shared); wtLog("engine", "apply: lecture distante"); t.play(); }
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
          // Le lookahead compense le temps de seek d'un lecteur EN LECTURE ;
          // un lecteur qui se pré-cale en pause vise exactement la cible.
          t.seekTo(expectedNew + (room.paused || futureAnchor ? 0 : seekLookaheadS(shared)));
          setTransportRate(shared, t, 1);
          shared.softCorrectionSinceRef.current = null;
        }
      }
    }

    if (!futureAnchor || skipApply) return;

    // ── Reprise planifiée : pré-calage en pause, puis play() à l'instant T ──
    // Même tolérance que la barrière qui vient de poser ce lecteur : un seek de
    // plus juste avant T ferait manquer l'instant (sur un HLS, mpv recule le
    // démuxeur de douze secondes à chaque seek précis).
    const targetS = room.positionTicks / TICKS_PER_SECOND;
    const preseekTolerance = t.precision === "coarse" ? WT_BARRIER_PRESEEK_MPV_S : WT_PRESEEK_TOLERANCE_S;
    if (needsPreseek(t.getPositionSeconds(), targetS, preseekTolerance)) {
      wtLog("engine", "apply: pré-calage avant reprise planifiée", { fromS: t.getPositionSeconds().toFixed(2), toS: targetS.toFixed(2) });
      armEcho(shared);
      t.seekTo(targetS);
      setTransportRate(shared, t, 1);
      shared.softCorrectionSinceRef.current = null;
    }
    const delay = computePlayDelayMs(room.stateAtServerTime, nowSrv, shared.playLatencyMsRef.current);
    const scheduled: ScheduledPlay = {
      epoch: room.epoch, timer: null, playCalledAt: null,
      until: Date.now() + delay + WT_SCHEDULED_PLAY_SETTLE_MS,
    };
    wtLog("engine", "apply: reprise planifiée", { inMs: delay, playLatencyMs: shared.playLatencyMsRef.current });
    scheduled.timer = setTimeout(() => {
      scheduled.timer = null;
      if (shared.scheduledPlayRef.current !== scheduled) return;
      const player = transportRef.current;
      if (!player) return;
      scheduled.playCalledAt = performance.now();
      armEcho(shared);
      wtLog("engine", "reprise planifiée : play()");
      player.play();
    }, delay);
    shared.scheduledPlayRef.current = scheduled;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, room?.epoch]);

  // Démontage / sortie de séance : plus aucun play() programmé ni sondage.
  useEffect(() => {
    if (!enabled) return;
    return () => {
      cancelScheduledPlay(shared);
      stopBarrierPoll();
      appliedSnapshotRef.current = null;
      confirmedBarrierRef.current = null;
    };
  }, [enabled, shared]);

  // ── Événements hors state/epoch, et l'écho de nos propres intents ──
  // Un autre membre, ou un autre appareil de ce compte : le serveur exclut la
  // socket émettrice, jamais le compte (gateway.ts). Filtrer `originUserId`
  // ici priverait le second appareil de l'hôte du refus — son décompte
  // partirait seul et son enchaînement embarquerait la salle.
  useEffect(() => {
    if (!enabled) return;
    return subscribeSocket((msg) => {
      if (msg.type === "wt:autonextDismiss") {
        wtLog("engine", "auto-next dismiss distant", { from: msg.originUserId });
        transportRef.current?.cancelAutoNext?.();
      } else if (
        msg.type === "wt:state" && msg.originUserId === shared.selfIdRef.current
        && (msg.cause === "play" || msg.cause === "pause" || msg.cause === "seek")
      ) {
        clearPendingIntent(shared);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
}
