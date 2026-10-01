import { useCallback, useEffect, useRef } from "react";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import {
  decideRecovery, MAX_VAIN_RESTARTS, PROBE_EVERY_MS, RESTART_COOLDOWN_MS, type Culprit, type Health, type RecoveryPhase,
} from "@tentacle-tv/tv-core";
import { readServerReachability, requestServerProbe } from "./serverReachability";
import { IDLE_TROUBLE, publishPlaybackTrouble, registerTroubleRetry } from "./playbackTroubleStore";
import { useStartupRecovery } from "./useStartupRecovery";
import type { RestartOptions, RestartOutcome } from "./streamRestart";
import { probeStreamPath } from "../utils/streamPathProbe";
import { plog } from "../utils/playerDiag";

/** Ce que la reprise lit du lecteur : le bus d'état et le pipeline de flux. */
export interface RecoverySources {
  s: {
    hasStarted: boolean;
    paused: boolean;
    isLoading: boolean;
    /** Rechargement VOULU en cours (piste, qualité, relance) : pas un arrêt. */
    reloadHold: boolean;
    positionRef: React.MutableRefObject<number>;
    bufferedTimeRef: React.MutableRefObject<number>;
    endedRef: React.MutableRefObject<boolean>;
  };
  p: {
    restartStream: (opts?: RestartOptions) => Promise<RestartOutcome>;
    /** L'ouverture du flux a échoué (écran d'échec, « Réessayer »). */
    failed: boolean;
    /** Relance l'ouverture — le « Réessayer » de l'écran d'échec. */
    setReloadNonce: (next: (n: number) => number) => void;
  };
}

/** Une erreur de FORMAT (codec, conteneur) : la chaîne de repli s'en charge. */
export function isFormatError(error: string): boolean {
  return error.includes("DECODING_FAILED") || error.includes("EXCEEDS_CAPABILITIES")
    || error.includes("codec") || error.includes("Could not open");
}
/** Le jeton du flux refusé : `useTVDirectStreamRecovery` le rafraîchit. */
const AUTH_ERROR = /\bhttp=40[13]\b/;

const TICK_MS = 1000;
/** Ce qui est chargé ne « fond » que sous ce seuil : au-dessus, la mémoire est pleine. */
const STARVING_AHEAD_MAX_S = 20;
/** La lecture a repris : elle avance de tant depuis l'incident. */
const PROGRESS_S = 2;

interface RecoveryState {
  stalledSince: number | null;
  lostSince: number | null;
  /** L'incident gardé ouvert par une relance (son rechargement n'est pas un arrêt). */
  openSince: number | null;
  /** Position quand l'incident s'est ouvert (perte, relance) — il se clôt quand elle avance. */
  incidentPos: number | null;
  buffered: { value: number; at: number };
  source: Health;
  culprit: Culprit | null;
  checkedAt: number | null;
  probing: boolean;
  manualProbe: boolean;
  stillDown: boolean;
  downSince: number | null;
  downWhat: Culprit | null;
  restarting: boolean;
  lastRestartAt: number | null;
  /** La relance en cours d'épreuve n'a pas encore fait avancer la lecture. */
  restartPending: boolean;
  vain: number;
}

const fresh = (): RecoveryState => ({
  stalledSince: null, lostSince: null, openSince: null, incidentPos: null, buffered: { value: 0, at: Date.now() },
  source: "unknown", culprit: null, checkedAt: null, probing: false, manualProbe: false, stillDown: false,
  downSince: null, downWhat: null, restarting: false, lastRestartAt: null, restartPending: false, vain: 0,
});

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

  const restart = useCallback(async () => {
    const st = state.current;
    const s = src.current;
    if (!s || st.restarting) return;
    // La relance précédente n'a jamais fait avancer la lecture : vaine.
    if (st.restartPending) st.vain += 1;
    st.restarting = true;
    st.restartPending = true;
    st.lastRestartAt = Date.now();
    // L'incident reste ouvert pendant le rechargement — sans le requalifier :
    // un arrêt de débit relancé reste un arrêt de débit.
    st.openSince ??= Math.min(st.lostSince ?? Infinity, st.stalledSince ?? Infinity, Date.now());
    st.incidentPos = s.s.positionRef.current;
    tickRef.current();
    const outcome = await s.p.restartStream({ reason: "network" });
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
    if (buffered > st.buffered.value + 0.5 || buffered < st.buffered.value - 1) {
      st.buffered = { value: buffered, at: now };
      const open = st.openSince !== null || st.lostSince !== null;
      if (st.buffered.value > pos && !stalled && !open) { st.downSince = null; st.downWhat = null; }
    }
    // L'incident se clôt quand la lecture avance de nouveau.
    if (st.incidentPos !== null && !stalled && !s.s.isLoading && pos >= st.incidentPos + PROGRESS_S) {
      plog("recover", `la lecture a repris à ${Math.round(pos)} s`);
      Object.assign(st, {
        lostSince: null, openSince: null, incidentPos: null, restartPending: false, vain: 0,
        downSince: null, downWhat: null, stillDown: false,
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
    });
    if (decision.probe) void probe();
    if (decision.restart) void restart();
  }, [probe, restart]);
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
  // relance si le serveur répond — même après des relances vaines.
  useEffect(() => {
    registerTroubleRetry(() => {
      const st = state.current;
      Object.assign(st, { vain: 0, lastRestartAt: null, restartPending: false, checkedAt: null, manualProbe: true, stillDown: false });
      void requestServerProbe();
      tickRef.current();
    });
    return () => {
      registerTroubleRetry(null);
      publishPlaybackTrouble(IDLE_TROUBLE);
    };
  }, []);

  useStartupRecovery(sources);

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
