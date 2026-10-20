import { useEffect } from "react";
import {
  WT_DRIFT_ENGAGE_MPV_S, WT_DRIFT_ENGAGE_WEB_S, WT_DRIFT_LOOP_MS, WT_DRIFT_SETTLE_MPV_S,
  WT_DRIFT_SETTLE_WEB_S, decideDrift, hardSeekProgress, isBarrierParticipant, isFutureAnchor, isWaitedForMe,
  updateSeekLatency,
  wtPositionSecondsAt,
} from "@tentacle-tv/shared";
import type { PlayerTransportRef } from "../playerPort";
import {
  armEcho, hasPendingIntent, isAwaitingScheduledPlay, seekLookaheadS, setTransportRate, type GroupSyncSharedRefs,
} from "./groupSyncRefs";
import { wtLog } from "../wtLog";


/**
 * Watch Together — boucle de correction de dérive (5 Hz).
 * Compare la position du player à la position canonique extrapolée du groupe
 * et applique la décision du contrôleur partagé (driftController) :
 * réconciliation pause/lecture, vitesse proportionnelle, seek dur, recalage
 * en pause. Mesure au passage la latence des seeks durs (lookahead adaptatif).
 *
 * La boucle NE corrige PAS quand :
 *  - le player n'a jamais été « prêt » depuis le montage (group-wait initial) ;
 *  - le group-wait en cours est causé par MOI (mon player charge : pause/seek
 *    tomberaient en plein démarrage HLS → demuxer coincé, écran noir) ;
 *  - un seek local est encore en vol (far-seek HLS : re-seeker à chaque tick
 *    relancerait ffmpeg en spirale — position figée, timer bloqué) ;
 *  - une reprise planifiée attend son instant (le play() est programmé par le
 *    moteur : réconcilier ici lancerait la lecture avant l'heure) ;
 *  - un intent local est en vol : entre une pause locale et son écho, la
 *    salle joue encore — réconcilier relancerait la lecture sous les doigts
 *    de l'utilisateur ; après un seek, elle le ramènerait en arrière.
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
    // Anti-spam : les raisons de skip se loggent au changement, pas à 5 Hz.
    let lastSkipLogged: string | null = null;
    let heldLoggedFor: number | null = null;
    const skip = (reason: string, message: string, data?: unknown) => {
      if (lastSkipLogged === reason) return;
      lastSkipLogged = reason;
      wtLog("engine", message, data);
    };
    const loop = setInterval(() => {
      const t = transportRef.current;
      const r = shared.roomRef.current;
      // Pas de correction tant que le player n'a pas été prêt une première fois
      // (chargement initial : le group-wait nous couvre).
      if (!t || !r || r.itemId !== itemId || shared.lastBufferingSentRef.current !== false) return;

      if (isBarrierParticipant(r, shared.selfIdRef.current)) {
        skip("barrier", "drift: SKIP — la salle m'attend sur une cible (barrière)");
        return;
      }
      if (isWaitedForMe(r, shared.selfIdRef.current)) {
        skip("waitedForMe", "drift: SKIP — group-wait causé par moi (player en (re)chargement)");
        return;
      }
      if (t.isSeeking?.()) {
        skip("seeking", "drift: SKIP — seek local encore en vol (pas de re-correction)");
        return;
      }
      const nowSrv = shared.serverNowRef.current();
      if (isFutureAnchor(r, nowSrv) || isAwaitingScheduledPlay(shared)) {
        skip("scheduled", "drift: SKIP — reprise planifiée en attente");
        return;
      }
      if (hasPendingIntent(shared)) {
        skip("intent", "drift: SKIP — intent local en vol", shared.pendingIntentRef.current);
        return;
      }
      lastSkipLogged = null;

      const expected = wtPositionSecondsAt(r, nowSrv);
      const pos = t.getPositionSeconds();

      // Un seek dur en cours : on attend que la lecture REPARTE (pas seulement
      // l'atterrissage) — sa latence, attente des segments comprise, devient le
      // lookahead du prochain ; d'ici là, aucun nouveau seek dur (un
      // transcodage re-sautait sinon toutes les 1,8 s sans jamais reprendre).
      let hardSeekHeld = false;
      const pending = shared.pendingHardSeekRef.current;
      if (pending) {
        const progress = hardSeekProgress(pending, pos, Date.now());
        if (progress.state === "resumed") {
          shared.seekLatencySRef.current = updateSeekLatency(shared.seekLatencySRef.current, progress.latencyS);
          shared.pendingHardSeekRef.current = null;
          wtLog("engine", "drift: seek dur — la lecture a repris", {
            latencyS: progress.latencyS.toFixed(2), emaS: shared.seekLatencySRef.current.toFixed(2),
          });
        } else if (progress.state === "expired") {
          shared.pendingHardSeekRef.current = null;
        } else {
          pending.lastPosS = pos;
          hardSeekHeld = true;
        }
      }

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

      const coarse = t.precision === "coarse";
      const drift = pos - expected; // > 0 : en avance sur le groupe
      const decision = decideDrift({
        driftS: drift,
        paused: r.paused,
        currentRate: shared.currentRateRef.current,
        engageS: coarse ? WT_DRIFT_ENGAGE_MPV_S : WT_DRIFT_ENGAGE_WEB_S,
        settleS: coarse ? WT_DRIFT_SETTLE_MPV_S : WT_DRIFT_SETTLE_WEB_S,
        correctingForMs: shared.softCorrectionSinceRef.current === null
          ? null : Date.now() - shared.softCorrectionSinceRef.current,
      });

      if (decision.seek === "paused") {
        wtLog("engine", "drift: recalage en pause", { posS: pos.toFixed(2), expectedS: expected.toFixed(2) });
        armEcho(shared);
        t.seekTo(expected);
      } else if (decision.seek === "hard" && hardSeekHeld) {
        // Une seule trace par seek retenu, pas une par battement.
        if (heldLoggedFor !== pending?.at) {
          heldLoggedFor = pending?.at ?? null;
          wtLog("engine", "drift: seek dur retenu — le précédent n'a pas encore repris la lecture", { driftS: drift.toFixed(2) });
        }
      } else if (decision.seek === "hard") {
        const lookahead = seekLookaheadS(shared);
        wtLog("engine", "drift: HARD — seek de recalage", {
          driftS: drift.toFixed(2), posS: pos.toFixed(1), expectedS: expected.toFixed(1), lookaheadS: lookahead.toFixed(2),
        });
        armEcho(shared);
        t.seekTo(expected + lookahead);
        shared.pendingHardSeekRef.current = { at: Date.now(), targetS: expected + lookahead, lastPosS: null };
      }

      if (decision.rate !== shared.currentRateRef.current) {
        wtLog("engine", decision.rate === 1 ? "drift: recalé — vitesse 1×" : "drift: correction douce", {
          driftS: drift.toFixed(3), rate: decision.rate,
        });
      }
      setTransportRate(shared, t, decision.rate);
      if (decision.rate === 1) shared.softCorrectionSinceRef.current = null;
      else if (shared.softCorrectionSinceRef.current === null) shared.softCorrectionSinceRef.current = Date.now();
    }, WT_DRIFT_LOOP_MS);
    return () => clearInterval(loop);
  }, [enabled, itemId, transportRef, shared]);
}
