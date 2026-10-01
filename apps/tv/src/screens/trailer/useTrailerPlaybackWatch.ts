import { useCallback, useEffect, useMemo, useRef } from "react";
import { AppState } from "react-native";
import type { OnLoadData, OnProgressData, OnVideoErrorData } from "react-native-video";

/**
 * Le chien de garde de la bande-annonce (Apple TV) : une lecture qui finit
 * TOUJOURS — par l'image à l'écran, par sa fin, ou par un échec que l'écran
 * dit (« indisponible »). AVPlayer, lui, peut attendre sans fin un flux qui
 * ne répond pas : mesuré au simulateur, plus d'une minute et demie de
 * chargement sans la moindre erreur.
 *
 * - « Démarrée » à la PREMIÈRE IMAGE (`onReadyForDisplay`), ou au premier
 *   temps qui avance — pas au chargement des métadonnées (`onLoad`) : le voile
 *   ne se lève jamais sur un lecteur encore noir.
 * - Pas d'image en `START_TIMEOUT_MS` : échec.
 * - Lancée, plus rien n'avance pendant `STALL_TIMEOUT_MS` : fin si l'on est au
 *   bout (AVPlayer n'émet pas toujours `onEnd`), échec sinon.
 * - En arrière-plan, AVPlayer se met en pause et reprend au retour : la garde
 *   aussi.
 *
 * Rend les gestionnaires à poser sur `<Video>`, stables ; aucun rendu à
 * chaque tic de progression.
 */

export const START_TIMEOUT_MS = 20_000;
export const STALL_TIMEOUT_MS = 15_000;
/** À moins de deux secondes de la fin, un arrêt EST la fin. */
const END_SLACK_S = 2;
/** Un temps qui avance de moins ne compte pas (bruit de l'horloge). */
const MIN_ADVANCE_S = 0.05;

export interface PlaybackWatchCallbacks {
  /** La première image est à l'écran. */
  onStarted: () => void;
  /** La raison va aux traces, jamais à l'écran. */
  onFailed: (reason: string) => void;
  onEnded: () => void;
}

interface WatchState {
  started: boolean;
  done: boolean;
  position: number;
  duration: number;
}

const fresh = (): WatchState => ({ started: false, done: false, position: 0, duration: 0 });

export function useTrailerPlaybackWatch(streamUrl: string | null, callbacks: PlaybackWatchCallbacks) {
  const latest = useRef(callbacks);
  latest.current = callbacks;
  const state = useRef<WatchState>(fresh());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const finish = useCallback((reason: string | null) => {
    if (state.current.done) return;
    state.current.done = true;
    clear();
    if (reason === null) latest.current.onEnded();
    else latest.current.onFailed(reason);
  }, [clear]);

  // L'attente en cours : la première image, ou le prochain pas du temps.
  const arm = useCallback(() => {
    clear();
    const s = state.current;
    if (s.done) return;
    if (!s.started) {
      timer.current = setTimeout(() => finish(`aucune image en ${START_TIMEOUT_MS / 1000} s`), START_TIMEOUT_MS);
      return;
    }
    timer.current = setTimeout(() => {
      const atEnd = s.duration > 0 && s.position >= s.duration - END_SLACK_S;
      finish(atEnd ? null : `lecture arrêtée ${STALL_TIMEOUT_MS / 1000} s à ${s.position.toFixed(1)} s`);
    }, STALL_TIMEOUT_MS);
  }, [clear, finish]);

  // Un flux neuf : tout recommence.
  useEffect(() => {
    state.current = fresh();
    if (!streamUrl) return clear;
    arm();
    const sub = AppState.addEventListener("change", (next) => (next === "active" ? arm() : clear()));
    return () => {
      sub.remove();
      clear();
    };
  }, [streamUrl, arm, clear]);

  const start = useCallback(() => {
    const s = state.current;
    if (s.started || s.done) return;
    s.started = true;
    arm();
    latest.current.onStarted();
  }, [arm]);

  return useMemo(
    () => ({
      onLoad: (data: OnLoadData) => {
        state.current.duration = data.duration;
      },
      onReadyForDisplay: start,
      onProgress: (data: OnProgressData) => {
        const s = state.current;
        if (data.currentTime < s.position + MIN_ADVANCE_S) return;
        s.position = data.currentTime;
        if (!s.started) return start();
        arm();
      },
      onError: (e: OnVideoErrorData) => {
        const err = e?.error;
        finish(`AVPlayer ${err?.code ?? "?"} : ${err?.localizedDescription ?? err?.localizedFailureReason ?? err?.error ?? "?"}`);
      },
      onEnd: () => finish(null),
    }),
    [start, arm, finish],
  );
}
