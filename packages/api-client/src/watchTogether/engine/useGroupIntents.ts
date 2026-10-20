import { useCallback, useEffect, useRef, type MutableRefObject } from "react";
import { getClockOffsetMs, getClockRttMs } from "../../socket/clockSync";
import { getSocketStatus, onSocketStatus } from "../../socket/tentacleSocket";
import {
  TICKS_PER_SECOND, WT_PROTOCOL_VERSION, WT_REQUEST_PLAY_WATCHDOG_MS,
  WT_SEEK_NOTIFY_DEBOUNCE_MS, formatWtSeekToken, isBarrierParticipant, needsStartCorrection, updatePlayLatency,
  wtPositionSecondsAt,
  type SegmentType,
} from "@tentacle-tv/shared";
import type { PlayerTransportRef } from "../playerPort";
import {
  armEcho, clearPendingIntent, isApplying, isSettledOn, seekLookaheadS, setPendingIntent, REMOTE_JUMP_THRESHOLD_S,
  WT_SEEK_DEVICE,
  type GroupSyncSharedRefs,
} from "./groupSyncRefs";
import { wtLog } from "../wtLog";

/**
 * Watch Together — les intents locaux (observe & report) : le player agit, le
 * moteur rapporte — sauf la LECTURE en séance, demandée au serveur SANS jouer
 * (`requestPlay`) pour que tous repartent au même instant planifié. Anti-écho
 * par fenêtre temporelle + comparaison d'état ; chaque intent envoyé reste
 * « en vol » jusqu'à son écho (voir groupSyncShared).
 */
export function useGroupIntents({
  active,
  itemId,
  transportRef,
  shared,
  declaredRef,
}: {
  active: boolean;
  itemId: string | undefined;
  transportRef: PlayerTransportRef;
  shared: GroupSyncSharedRefs;
  /** La déclaration au groupe (presence + buffering) a été faite pour ce montage. */
  declaredRef: MutableRefObject<boolean>;
}) {
  const posTicks = useCallback(() => {
    const s = transportRef.current?.getPositionSeconds() ?? 0;
    return Math.max(0, Math.round(s * TICKS_PER_SECOND));
  }, [transportRef]);

  const rtt = () => getClockRttMs() ?? undefined;

  const notifyPlayState = useCallback((paused: boolean) => {
    const r = shared.roomRef.current;
    if (!active || !r || r.itemId !== itemId) return;
    // Le play() d'une reprise planifiée vient de prendre : c'est la latence de
    // démarrage de CE lecteur — mesurée, lissée, retranchée la prochaine fois.
    const scheduled = shared.scheduledPlayRef.current;
    if (!paused && scheduled?.playCalledAt !== null && scheduled?.playCalledAt !== undefined) {
      const measured = performance.now() - scheduled.playCalledAt;
      shared.playLatencyMsRef.current = updatePlayLatency(shared.playLatencyMsRef.current, measured);
      shared.scheduledPlayRef.current = null;
      // Parti en retard (onglet en arrière-plan, sortie audio lente) ou en
      // avance (lecture automatique) : à ±5 %, une seconde prendrait vingt
      // secondes — UN seek correctif, tout de suite.
      const t = transportRef.current;
      const behind = wtPositionSecondsAt(r, shared.serverNowRef.current()) - (t?.getPositionSeconds() ?? 0);
      wtLog("engine", "reprise planifiée : lecture effective", {
        latencyMs: Math.round(measured), emaMs: shared.playLatencyMsRef.current, behindS: behind.toFixed(2),
      });
      if (t && !r.paused && needsStartCorrection(behind)) {
        const target = wtPositionSecondsAt(r, shared.serverNowRef.current()) + seekLookaheadS(shared);
        wtLog("engine", "reprise planifiée : départ décalé → seek correctif", { toS: target.toFixed(2), behindS: behind.toFixed(2) });
        armEcho(shared);
        t.seekTo(target);
      }
      return;
    }
    // (Re)chargement local en cours : les flips pause de mpv sont des artefacts
    // du loadfile (pause=false forcé avant chargement…), pas des intents — un
    // wt:play parti d'ici forcerait la reprise du group-wait et éjecterait les
    // membres encore attendus (waitingFor.clear() côté serveur).
    if (shared.lastBufferingSentRef.current !== false) {
      wtLog("engine", `intent play/pause ignoré (player en chargement déclaré), paused=${paused}`);
      return;
    }
    if (isApplying(shared)) {
      wtLog("engine", `intent play/pause ignoré (écho d'une commande distante), paused=${paused}`);
      return;
    }
    if (r.paused === paused) return; // no-op / écho tardif
    wtLog("engine", `intent → wt:${paused ? "pause" : "play"}`, { posS: (posTicks() / TICKS_PER_SECOND).toFixed(1) });
    setPendingIntent(shared, paused ? "pause" : "play", getClockRttMs());
    shared.sendRef.current({ type: paused ? "wt:pause" : "wt:play", positionTicks: posTicks() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, itemId, posTicks]);

  /** Seeks rapprochés (flèches martelées) : un seul wt:seek, le dernier. */
  const seekDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** `explicit` : un geste de l'utilisateur (barre, flèches, bouton de saut),
   *  pas un saut déduit d'une discontinuité — la dédup contre la position de
   *  la salle est alors plus serrée (relâcher la poignée là où l'on est n'est
   *  pas un seek), et rien d'autre ne le filtre. */
  const notifySeek = useCallback((seconds: number, opts?: { explicit?: boolean }) => {
    const r = shared.roomRef.current;
    if (!active || !r || r.itemId !== itemId) return;
    // Sauts de position pendant un (re)chargement = start-position/artefacts.
    if (shared.lastBufferingSentRef.current !== false) {
      wtLog("engine", "intent seek ignoré (player en chargement déclaré)", { toS: seconds.toFixed(1) });
      return;
    }
    if (!opts?.explicit && isApplying(shared)) {
      wtLog("engine", "intent seek ignoré (écho d'un seek distant)", { toS: seconds.toFixed(1) });
      return;
    }
    // Dédup : un seek vers la position (extrapolée) du groupe est un recalage
    // local (ex. fallback niveau 3 différé d'un seek distant), pas un intent.
    const nearGroup = Math.abs(seconds - wtPositionSecondsAt(r, shared.serverNowRef.current()));
    if (nearGroup < (opts?.explicit ? 0.3 : REMOTE_JUMP_THRESHOLD_S)) return;
    // Le numéro est pris à l'APPUI, pas à l'envoi : un écho de seek plus ancien
    // qui arrive pendant le regroupement est déjà reconnu comme tel (B7).
    const seq = (shared.localSeekRef.current?.seq ?? 0) + 1;
    shared.localSeekRef.current = { seq, at: Date.now() };
    wtLog("engine", "intent → wt:seek (regroupé)", { toS: seconds.toFixed(1), explicit: !!opts?.explicit, seq });
    setPendingIntent(shared, "seek", getClockRttMs());
    if (seekDebounceRef.current) clearTimeout(seekDebounceRef.current);
    seekDebounceRef.current = setTimeout(() => {
      seekDebounceRef.current = null;
      shared.sendRef.current({
        type: "wt:seek",
        positionTicks: Math.max(0, Math.round(seconds * TICKS_PER_SECOND)),
        seekToken: formatWtSeekToken({ device: WT_SEEK_DEVICE, seq }),
      });
    }, WT_SEEK_NOTIFY_DEBOUNCE_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, itemId]);

  const sendPresence = useCallback(() => {
    if (!itemId) return;
    shared.sendRef.current({ type: "wt:presence", inPlayback: true, itemId, protocolVersion: WT_PROTOCOL_VERSION, rttMs: rtt() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

  /** `freezeAtSeconds` : la position à laquelle geler la salle quand c'est un
   *  rechargement qui commence — celle que le rechargement VISE (la page la
   *  connaît), pas celle qu'un lecteur en train de se détruire rapporte. */
  const notifyBuffering = useCallback((buffering: boolean, freezeAtSeconds?: number) => {
    const r = shared.roomRef.current;
    if (!active || !r || r.itemId !== itemId) return;
    // Re-présence : si le serveur m'a éjecté de la lecture (timeout anti-gel
    // 60 s → playbackError, ou présence perdue), mes wt:buffering seraient
    // traités comme de simples mises à jour de statut — plus JAMAIS de
    // group-wait pour moi, le groupe ne m'attendrait plus. Se re-déclarer.
    const selfId = shared.selfIdRef.current;
    const self = selfId ? r.members.find((m) => m.userId === selfId) : undefined;
    if (self && !self.inPlayback && declaredRef.current) {
      wtLog("engine", "re-présence (le serveur me croyait hors lecture)", { playbackError: self.playbackError });
      sendPresence();
    }
    if (shared.lastBufferingSentRef.current === buffering) return;
    shared.lastBufferingSentRef.current = buffering;
    const positionTicks = freezeAtSeconds !== undefined
      ? Math.max(0, Math.round(freezeAtSeconds * TICKS_PER_SECOND))
      : posTicks();
    // « Je cale » pendant une barrière : la salle m'attend de nouveau — ma
    // confirmation d'avant ne vaut plus, je re-confirmerai (défaut M1 du banc :
    // sans cela, la barrière restait gelée jusqu'à son délai).
    if (buffering) shared.confirmedBarrierRef.current = null;
    // Prêt ET déjà posé sur la cible d'une barrière qui m'attend : le « prêt »
    // part avec son identifiant — sans lui, le serveur n'y lit qu'une fin de
    // chargement (il me fera alors me caler, puis confirmer).
    const t = transportRef.current;
    const barrierId = !buffering && r.barrierId !== undefined && isBarrierParticipant(r, selfId) && t
      && isSettledOn(t, r.positionTicks / TICKS_PER_SECOND) ? r.barrierId : undefined;
    if (barrierId !== undefined) shared.confirmedBarrierRef.current = barrierId;
    wtLog("engine", `intent → wt:buffering ${buffering}`, { posS: (positionTicks / TICKS_PER_SECOND).toFixed(1), barrierId });
    shared.sendRef.current({
      type: "wt:buffering", buffering, positionTicks, rttMs: rtt(), ...(barrierId !== undefined ? { barrierId } : {}),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, itemId, posTicks, sendPresence]);

  const notifyFatalError = useCallback(() => {
    if (!active || !itemId) return;
    wtLog("engine", "intent → wt:playbackError (média illisible ici)", { itemId });
    shared.lastBufferingSentRef.current = null; // fige la boucle de drift
    shared.sendRef.current({ type: "wt:playbackError", itemId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, itemId]);

  const notifyAutoNextDismiss = useCallback(() => {
    const r = shared.roomRef.current;
    if (!active || !r || r.itemId !== itemId) return;
    shared.sendRef.current({ type: "wt:autonextDismiss" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, itemId]);

  const notifySkipIntroDismiss = useCallback((segmentType: SegmentType) => {
    const r = shared.roomRef.current;
    if (!active || !r || r.itemId !== itemId) return;
    shared.sendRef.current({ type: "wt:skipIntroDismiss", segmentType });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, itemId]);

  /**
   * Lecture demandée par l'utilisateur en séance : on ne joue PAS, on demande
   * au serveur, qui planifie une reprise commune. Renvoie false quand le
   * chemin natif (jouer tout de suite) reste le bon : hors séance, salle déjà
   * en lecture, lecteur en chargement, socket fermé, horloge encore inconnue.
   * Sans réponse dans les deux secondes, on joue localement — la boucle de
   * dérive remettra tout d'aplomb.
   */
  const requestPlay = useCallback((): boolean => {
    const r = shared.roomRef.current;
    const t = transportRef.current;
    if (!active || !r || r.itemId !== itemId || !t || !r.paused) return false;
    if (shared.lastBufferingSentRef.current !== false) return false;
    if (getSocketStatus() !== "open" || getClockOffsetMs() === null) return false;
    // Le geste de l'utilisateur est LÀ : sur WebKit, un play() différé n'est
    // permis que si l'élément a déjà joué dans un geste — on l'y amène
    // maintenant, sans rien laisser voir (écho couvert).
    armEcho(shared);
    t.primeGesture?.();
    setPendingIntent(shared, "play", getClockRttMs());
    const epoch = r.epoch;
    if (!shared.sendRef.current({ type: "wt:play", positionTicks: posTicks() })) {
      clearPendingIntent(shared);
      return false;
    }
    wtLog("engine", "requestPlay → wt:play (reprise planifiée demandée)", { posS: (posTicks() / TICKS_PER_SECOND).toFixed(1) });
    setTimeout(() => {
      const now = shared.roomRef.current;
      if (!now || now.epoch !== epoch || !now.paused) return;
      wtLog("engine", "requestPlay : pas de réponse du serveur → lecture locale");
      clearPendingIntent(shared);
      armEcho(shared);
      transportRef.current?.play();
    }, WT_REQUEST_PLAY_WATCHDOG_MS);
    return true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, itemId, posTicks]);

  // ── Reconnexion : ce qui a pu se perdre pendant la coupure ──
  // `sendSocketMessage` jette les messages tant que le socket est fermé ; un
  // « prêt » perdu gèlerait la salle jusqu'au sweep. À chaque réouverture, on
  // redit où l'on en est (le provider ne redemande, lui, que l'état).
  const wasOpenRef = useRef(getSocketStatus() === "open");
  useEffect(() => {
    if (!active) return;
    return onSocketStatus((status) => {
      const open = status === "open";
      const reopened = open && !wasOpenRef.current;
      wasOpenRef.current = open;
      if (!reopened || !declaredRef.current) return;
      wtLog("engine", "reconnexion : re-déclaration presence + buffering");
      sendPresence();
      const last = shared.lastBufferingSentRef.current;
      if (last === null) return;
      // Posé sur la cible d'une barrière : le « prêt » a pu se perdre pendant la
      // coupure — il repart AVEC l'identifiant (sans lui, le serveur n'y lit
      // qu'une fin de chargement, pas un « posé »).
      const r = shared.roomRef.current;
      const t = transportRef.current;
      const barrierId = last === false && r?.barrierId !== undefined && t
        && isSettledOn(t, r.positionTicks / TICKS_PER_SECOND) ? r.barrierId : undefined;
      shared.sendRef.current({
        type: "wt:buffering", buffering: last, positionTicks: posTicks(), rttMs: rtt(),
        ...(barrierId !== undefined ? { barrierId } : {}),
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, sendPresence, posTicks]);

  return {
    notifyPlayState, notifySeek, notifyBuffering, notifyFatalError,
    notifyAutoNextDismiss, notifySkipIntroDismiss, requestPlay, sendPresence,
  };
}
