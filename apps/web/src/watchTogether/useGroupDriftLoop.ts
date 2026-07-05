import { useEffect } from "react";
import {
  WT_DRIFT_HARD_S, WT_DRIFT_LOOP_MS, WT_DRIFT_PAUSED_S, WT_DRIFT_SETTLED_S,
  WT_DRIFT_SOFT_S, WT_RATE_CATCHUP, WT_RATE_SLOWDOWN, WT_SEEK_LOOKAHEAD_S,
  WT_SOFT_CORRECTION_TIMEOUT_MS, wtPositionSecondsAt,
} from "@tentacle-tv/shared";
import type { PlayerTransportRef } from "./playerTransport";
import { armEcho, isWaitedForMe, setTransportRate, type GroupSyncSharedRefs } from "./groupSyncShared";
import { wtLog } from "./wtLog";

/**
 * Watch Together — boucle de correction de dérive (1 Hz).
 * Compare la position du player à la position canonique extrapolée du groupe :
 * réconciliation pause/lecture, recalage dur (seek), rattrapage doux (vitesse
 * 0.95/1.05), retour à 1× une fois recalé.
 *
 * La boucle NE corrige PAS quand :
 *  - le player n'a jamais été « prêt » depuis le montage (group-wait initial) ;
 *  - le group-wait en cours est causé par MOI (mon player charge : pause/seek
 *    tomberaient en plein démarrage HLS → demuxer coincé, écran noir) ;
 *  - un seek local est encore en vol (far-seek HLS : re-seeker à chaque tick
 *    relancerait ffmpeg en spirale — position figée, timer bloqué).
 */
export function useGroupDriftLoop({
  enabled,
  itemId,
  transportRef,
  shared,
}: {
  enabled: boolean;
  itemId: string | undefined;
  transportRef: PlayerTransportRef;
  shared: GroupSyncSharedRefs;
}) {
  useEffect(() => {
    if (!enabled) return;
    // Anti-spam : les raisons de skip se loggent au changement, pas à 1 Hz.
    let lastSkipLogged: string | null = null;
    const loop = setInterval(() => {
      const t = transportRef.current;
      const r = shared.roomRef.current;
      // Pas de correction tant que le player n'a pas été prêt une première fois
      // (chargement initial : le group-wait nous couvre).
      if (!t || !r || r.itemId !== itemId || shared.lastBufferingSentRef.current !== false) return;

      if (isWaitedForMe(r, shared.selfIdRef.current)) {
        if (lastSkipLogged !== "waitedForMe") {
          lastSkipLogged = "waitedForMe";
          wtLog("engine", "drift: SKIP — group-wait causé par moi (player en (re)chargement)");
        }
        return;
      }
      if (t.isSeeking?.()) {
        if (lastSkipLogged !== "seeking") {
          lastSkipLogged = "seeking";
          wtLog("engine", "drift: SKIP — seek local encore en vol (pas de re-correction)");
        }
        return;
      }
      lastSkipLogged = null;

      const expected = wtPositionSecondsAt(r, shared.serverNowRef.current());
      const pos = t.getPositionSeconds();

      // Réconciliation pause/lecture (rattrape un play() refusé par la policy,
      // un broadcast perdu…).
      if (t.isPaused() !== r.paused) {
        wtLog("engine", "drift: réconciliation pause/lecture", {
          roomPaused: r.paused, playerPaused: t.isPaused(), posS: pos.toFixed(1),
        });
        armEcho(shared);
        if (r.paused) t.pause();
        else t.play();
      }

      if (r.paused) {
        setTransportRate(shared, t, 1);
        shared.softCorrectionSinceRef.current = null;
        if (Math.abs(pos - expected) > WT_DRIFT_PAUSED_S) {
          wtLog("engine", "drift: recalage en pause", { posS: pos.toFixed(1), expectedS: expected.toFixed(1) });
          armEcho(shared);
          t.seekTo(expected);
        }
        return;
      }

      const drift = pos - expected; // > 0 : en avance sur le groupe
      const abs = Math.abs(drift);

      if (abs >= WT_DRIFT_HARD_S) {
        wtLog("engine", "drift: HARD — seek de recalage", {
          driftS: drift.toFixed(2), posS: pos.toFixed(1), expectedS: expected.toFixed(1),
        });
        armEcho(shared);
        t.seekTo(expected + WT_SEEK_LOOKAHEAD_S);
        setTransportRate(shared, t, 1);
        shared.softCorrectionSinceRef.current = null;
        return;
      }
      if (abs >= WT_DRIFT_SOFT_S) {
        if (shared.softCorrectionSinceRef.current === null) {
          shared.softCorrectionSinceRef.current = Date.now();
          wtLog("engine", "drift: correction douce ON", {
            driftS: drift.toFixed(2), rate: drift > 0 ? WT_RATE_SLOWDOWN : WT_RATE_CATCHUP,
          });
        } else if (Date.now() - shared.softCorrectionSinceRef.current > WT_SOFT_CORRECTION_TIMEOUT_MS) {
          // Rattrapage doux inefficace → recalage dur.
          wtLog("engine", "drift: correction douce inefficace → HARD seek", {
            driftS: drift.toFixed(2), posS: pos.toFixed(1), expectedS: expected.toFixed(1),
          });
          armEcho(shared);
          t.seekTo(expected + WT_SEEK_LOOKAHEAD_S);
          setTransportRate(shared, t, 1);
          shared.softCorrectionSinceRef.current = null;
          return;
        }
        setTransportRate(shared, t, drift > 0 ? WT_RATE_SLOWDOWN : WT_RATE_CATCHUP);
        return;
      }
      if (abs <= WT_DRIFT_SETTLED_S && shared.currentRateRef.current !== 1) {
        wtLog("engine", "drift: recalé — correction douce OFF", { driftS: drift.toFixed(2) });
        setTransportRate(shared, t, 1);
        shared.softCorrectionSinceRef.current = null;
      }
    }, WT_DRIFT_LOOP_MS);
    return () => clearInterval(loop);
  }, [enabled, itemId, transportRef, shared]);
}
