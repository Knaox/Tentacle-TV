import { useCallback, useEffect, useRef } from "react";
import { unstable_batchedUpdates } from "react-native";
import { cachedBitrate, useJellyfinClient } from "@tentacle-tv/api-client";
import {
  decideProducerDeath, decideRecovery, MAX_VAIN_RESTARTS, PROBE_EVERY_MS, RESTART_COOLDOWN_MS, shouldCheckProducer,
  type RecoveryPhase,
} from "@tentacle-tv/tv-core";
import { freshRecoveryState as fresh, type RecoveryState } from "./recoveryState";
import { readServerReachability, requestServerProbe } from "./serverReachability";
import { IDLE_TROUBLE, noteServerFallback, publishPlaybackTrouble, registerTroubleRetry } from "./playbackTroubleStore";
import { useStartupRecovery } from "./useStartupRecovery";
import { useStartupWait } from "./useStartupWait";
import { isFormatError, type RecoverySources } from "./recoverySources";
import type { RestartReason } from "./streamRestart";
import { prismStatus } from "../utils/prismCoreStart";
import { probeStreamPath } from "../utils/streamPathProbe";
import { plog } from "../utils/playerDiag";

export { isFormatError, type RecoverySources } from "./recoverySources";

/** Le jeton du flux refusé : `useTVDirectStreamRecovery` le rafraîchit. */
const AUTH_ERROR = /\bhttp=40[13]\b/;

const TICK_MS = 1000;
/** Ce qui est chargé ne « fond » que sous ce seuil : au-dessus, la mémoire est pleine. */
const STARVING_AHEAD_MAX_S = 20;
/** La lecture a repris : elle avance de tant depuis l'incident. */
const PROGRESS_S = 2;

/**
 * La reprise d'une lecture quand un serveur tombe : observe le lecteur, sonde
 * le chemin du flux, relance le flux à la position quand le serveur revient
 * (`restartStream`, même forme), et publie l'état que l'habillage dit
 * (`playbackTroubleStore`). La DÉCISION est dans tv-core (`decideRecovery`).
 *
 * Commune aux deux téléviseurs, sans `Platform.OS` : montée par le
 * gestionnaire d'erreurs du lecteur, qui lui confie d'abord toute erreur
 * survenue APRÈS le démarrage (`onSourceLost`) — ni de format, ni
 * d'authentification. Relances vaines, serveur joignable : elle rend la main
 * à la chaîne de repli (forme muxée, transcodage).
 */
export function usePlaybackRecovery(sources: RecoverySources | undefined) {
  const client = useJellyfinClient();
  const src = useRef(sources);
  src.current = sources;
  const state = useRef<RecoveryState>(fresh());
  const phaseRef = useRef<RecoveryPhase>({ kind: "none" });
  const tickRef = useRef<() => void>(() => {});

  const probe = useCallback(async () => {
    const st = state.current;
    if (st.probing) return;
    st.probing = true;
    const result = await probeStreamPath(client);
    st.probing = false;
    st.checkedAt = Date.now();
    st.source = result.ok ? "ok" : "down";
    st.culprit = result.culprit;
    if (!result.ok && st.downSince === null) {
      st.downSince = st.checkedAt;
      st.downWhat = result.culprit;
    }
    st.stillDown = st.manualProbe && !result.ok;
    st.manualProbe = false;
    plog("recover", `sonde du chemin du flux → ${result.ok ? "répond" : `muet (${result.culprit})`}`);
    tickRef.current();
  }, [client]);

  const restart = useCallback(async (reason: RestartReason = "network") => {
    const st = state.current;
    const s = src.current;
    if (!s || st.restarting) return;
    // La relance précédente n'a jamais fait avancer la lecture : vaine.
    if (st.restartPending) st.vain += 1;
    st.restarting = true;
    st.restartPending = true;
    st.retryAsked = false;
    st.lastRestartAt = Date.now();
    // Un flux neuf : l'échéance d'un transcodage qui se fait attendre repart.
    st.lastProgressAt = st.lastRestartAt;
    // L'incident reste ouvert pendant le rechargement — sans le requalifier :
    // un arrêt de débit relancé reste un arrêt de débit.
    st.openSince ??= Math.min(st.lostSince ?? Infinity, st.stalledSince ?? Infinity, Date.now());
    st.incidentPos = s.s.positionRef.current;
    tickRef.current();
    const outcome = await s.p.restartStream({ reason });
    st.restarting = false;
    // Le délai laissé au flux relancé court depuis SON émission : par le proxy,
    // rouvrir PrismCore a pris 5 s, et la relance suivante partait avant que
    // la première ait pu jouer (mesuré : 21 s au lieu d'une quinzaine).
    st.lastRestartAt = Date.now();
    if (outcome !== "ok") {
      st.restartPending = false;
      if (outcome === "failed") st.vain += 1;
    }
    tickRef.current();
  }, []);

  // Le producteur de PrismCore : AVPlayer ne dit jamais sa mort, il relance ses
  // segments sans fin. Mort : une relance NEUVE ; remort au même endroit : le
  // chemin serveur à la position, et l'habillage le dit (`producerDeath`, tv-core).
  const checkProducer = useCallback(async () => {
    const s = src.current;
    const st = state.current;
    const gen = s?.p.prism?.gen ?? 0;
    if (!s || gen <= 0) return;
    st.producerChecking = true;
    st.producerCheckedAt = Date.now();
    const status = await prismStatus(gen);
    st.producerChecking = false;
    const at = s.s.positionRef.current;
    const action = decideProducerDeath({ status, position: at, previous: st.producerDeath });
    if (action === "none") return;
    plog("recover", `producteur PrismCore mort (${status?.code ?? "?"}) à ${Math.round(at)} s → ${action === "restart" ? "relance neuve" : "chemin serveur"}`);
    st.producerDeath = { gen, at };
    if (action === "restart") { void restart("remux"); return; }
    noteServerFallback(Date.now());
    // Groupés (après un `await`, l'ancienne architecture ne groupe pas) : sinon la
    // position seule rouvre d'abord la session morte, avant le transcodage.
    unstable_batchedUpdates(() => { s.p.captureReloadTicks(); s.p.setForceTranscode(true); });
  }, [restart]);

  const tick = useCallback(() => {
    const s = src.current;
    if (!s) return;
    const st = state.current;
    const now = Date.now();
    const { positionRef, bufferedTimeRef } = s.s;
    const pos = positionRef.current;
    const buffered = bufferedTimeRef.current;
    const stalled = st.stalledSince !== null;

    // Ce qui est chargé grossit (ou un saut l'a déplacé) : la source nourrit.
    // Pendant un incident ouvert, c'est la clôture qui oublie la panne : le flux
    // relancé se remplit avant d'avancer, et la cause basculait sur « débit ».
    const grew = buffered > st.buffered.value + 0.5;
    // Un signe de vie : la mémoire qui grossit, la position qui avance.
    if (grew || pos > st.lastPos + 0.5) st.lastProgressAt = now;
    st.lastPos = pos;
    if (grew || buffered < st.buffered.value - 1) {
      st.buffered = { value: buffered, at: now };
      const open = st.openSince !== null || st.lostSince !== null;
      if (st.buffered.value > pos && !stalled && !open) { st.downSince = null; st.downWhat = null; }
    }
    // L'incident se clôt quand la lecture avance de nouveau.
    if (st.incidentPos !== null && !stalled && !s.s.isLoading && pos >= st.incidentPos + PROGRESS_S) {
      plog("recover", `la lecture a repris à ${Math.round(pos)} s`);
      Object.assign(st, {
        lostSince: null, openSince: null, incidentPos: null, restartPending: false, vain: 0,
        downSince: null, downWhat: null, stillDown: false, retryAsked: false,
      });
    }
    const ahead = Math.max(0, buffered - pos);
    const decision = decideRecovery({
      now,
      started: s.s.hasStarted,
      paused: s.s.paused,
      ended: s.s.endedRef.current,
      stalledSince: st.stalledSince,
      lostSince: st.lostSince,
      openSince: st.openSince,
      ahead,
      starvingSince: !s.s.paused && !stalled && ahead <= STARVING_AHEAD_MAX_S ? st.buffered.at : null,
      tentacle: readServerReachability().reachable ? "ok" : "down",
      source: st.source,
      sourceCulprit: st.culprit,
      sourceCheckedAt: st.checkedAt,
      probing: st.probing,
      downSince: st.downSince,
      downWhat: st.downWhat,
      // En vol, ou relancé sans avoir encore avancé (le temps de démarrer).
      restarting: st.restarting || (st.restartPending && st.lastRestartAt !== null && now - st.lastRestartAt < RESTART_COOLDOWN_MS),
      lastRestartAt: st.lastRestartAt,
      vainRestarts: st.vain,
      // Un transcodage du serveur qui se fait attendre n'est ni une panne ni
      // un réseau lent ; le réseau n'est accusé que mesuré sous le besoin du flux.
      transcoding: !s.p.isDirectPlay && !s.p.isPrismCore,
      lastProgressAt: st.lastProgressAt,
      measuredBps: cachedBitrate(),
      neededBps: s.p.streamBitrate,
      retryAsked: st.retryAsked,
    });
    if (decision.phase.kind !== phaseRef.current.kind) {
      plog("recover", `${phaseRef.current.kind} → ${decision.phase.kind}${"cause" in decision.phase ? ` (${decision.phase.cause})` : ""}`);
    }
    phaseRef.current = decision.phase;
    const incident = decision.phase.kind !== "none";
    publishPlaybackTrouble({
      phase: decision.phase.kind === "degraded" ? { ...decision.phase, ahead: Math.floor(ahead) } : decision.phase,
      nextCheckAt: incident && st.checkedAt !== null && st.source !== "ok" ? st.checkedAt + PROBE_EVERY_MS : null,
      checking: st.probing,
      stillDown: st.stillDown,
      startCulprit: null,
      startWait: null,
    });
    if (decision.probe) void probe();
    if (decision.restart) void restart(st.retryAsked ? "manual" : "network");
    if (shouldCheckProducer({
      prismCore: s.p.isPrismCore, now, stalledSince: st.stalledSince, lastCheckAt: st.producerCheckedAt,
      restarting: st.restarting || st.producerChecking,
    })) void checkProducer();
  }, [probe, restart, checkProducer]);
  tickRef.current = tick;

  // L'arrêt : le lecteur attend des données, sans rechargement voulu ni pause.
  const stalled = !!sources && sources.s.hasStarted && sources.s.isLoading && !sources.s.paused && !sources.s.reloadHold;
  useEffect(() => {
    const st = state.current;
    if (stalled) st.stalledSince ??= Date.now();
    else st.stalledSince = null;
    tickRef.current();
  }, [stalled]);

  // Un nouveau flux qui démarre de zéro (autre titre) : nouvelle histoire.
  const started = !!sources?.s.hasStarted;
  useEffect(() => {
    if (!started) {
      state.current = fresh();
      publishPlaybackTrouble(IDLE_TROUBLE);
      return undefined;
    }
    const timer = setInterval(() => tickRef.current(), TICK_MS);
    return () => clearInterval(timer);
  }, [started]);

  // « Réessayer » de l'habillage : une vérification tout de suite, et la
  // relance dès que le serveur répond — même après des relances vaines, et
  // même pour un transcodage qu'on laissait travailler.
  useEffect(() => {
    registerTroubleRetry(() => {
      const st = state.current;
      Object.assign(st, {
        vain: 0, lastRestartAt: null, restartPending: false, checkedAt: null, manualProbe: true, stillDown: false, retryAsked: true,
      });
      void requestServerProbe();
      tickRef.current();
    });
    return () => {
      registerTroubleRetry(null);
      publishPlaybackTrouble(IDLE_TROUBLE);
      noteServerFallback(null);
    };
  }, []);

  useStartupRecovery(sources);
  useStartupWait(sources);

  /** Confiée en premier par le gestionnaire d'erreurs : `true` = prise en charge. */
  const onSourceLost = useCallback((error: string): boolean => {
    const s = src.current;
    const st = state.current;
    if (!s || !s.s.hasStarted || s.s.endedRef.current) return false;
    if (isFormatError(error) || AUTH_ERROR.test(error)) return false;
    // Serveur joignable et relances vaines : la chaîne de repli reprend la main.
    if (st.vain >= MAX_VAIN_RESTARTS && st.source === "ok") return false;
    st.lostSince ??= Date.now();
    st.incidentPos ??= s.s.positionRef.current;
    plog("recover", `source perdue (${error.slice(0, 80)}) → reprise`);
    tickRef.current();
    return true;
  }, []);

  return { onSourceLost };
}
