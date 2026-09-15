import { useEffect, useRef } from "react";
import { subscribeSocket } from "@tentacle-tv/api-client";
import {
  TICKS_PER_SECOND, WT_SCHEDULED_PLAY_SETTLE_MS, wtPositionSecondsAt,
  type WtRoomStateDto,
} from "@tentacle-tv/shared";
import type { PlayerTransportRef } from "./playerTransport";
import {
  armEcho, cancelScheduledPlay, clearPendingIntent, isWaitedForMe, seekLookaheadS, setTransportRate,
  REMOTE_JUMP_THRESHOLD_S, type GroupSyncSharedRefs, type ScheduledPlay,
} from "./groupSyncShared";
import { computePlayDelayMs, isFutureAnchor, needsPreseek } from "./groupSchedule";
import { wtLog } from "./wtLog";

/**
 * Watch Together — application des états distants au lecteur local :
 * pause/lecture, seeks distants (sauts entre deux états), et la REPRISE
 * PLANIFIÉE — quand la salle joue depuis un instant encore à venir, le lecteur
 * se pré-cale sur la position gelée puis lance la lecture à cet instant-là,
 * un peu avant pour absorber sa propre latence de démarrage. La correction de
 * dérive continue vit dans useGroupDriftLoop.
 */
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

    // Group-wait dont JE suis la cause (mon player charge/bufferise) OU
    // (re)chargement local déclaré encore en cours (rebuild qualité pendant
    // une pause utilisateur p.ex. — la room n'est alors PAS en pauseReason
    // buffering) : ne m'appliquer NI pause NI seek — mpv pausé/seeké pendant
    // un loadfile ne décode pas la première frame (écran noir) et ne
    // signalerait jamais « prêt ». La boucle de drift réconciliera pause et
    // position dès que le player aura signalé « prêt ».
    const waitedForMe = isWaitedForMe(room, shared.selfIdRef.current);
    const loadingSelf = shared.lastBufferingSentRef.current === true;
    const skipApply = waitedForMe || loadingSelf;
    const futureAnchor = isFutureAnchor(room, nowSrv);

    wtLog("engine", `état reçu epoch=${room.epoch}`, {
      paused: room.paused, reason: room.pauseReason, futureAnchor,
      roomPosS: (room.positionTicks / TICKS_PER_SECOND).toFixed(1),
      waiting: room.waitingForUserIds.length, waitedForMe, loadingSelf,
      playerPaused: t.isPaused(), playerPosS: t.getPositionSeconds().toFixed(1),
    });

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
    const targetS = room.positionTicks / TICKS_PER_SECOND;
    if (needsPreseek(t.getPositionSeconds(), targetS)) {
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

  // Démontage / sortie de séance : plus aucun play() programmé.
  useEffect(() => {
    if (!enabled) return;
    return () => { cancelScheduledPlay(shared); appliedSnapshotRef.current = null; };
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
