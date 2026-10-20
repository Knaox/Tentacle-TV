import { useCallback, useEffect, useReducer, useRef, useState, type MutableRefObject } from "react";
import type { EngineProgressData } from "@/player/engine/types";
import { createMobileTransport, type MobileTransport, type MobileTransportCommands } from "./mobileTransport";
import { planReadySignal } from "./readySignal";
import { benchRaw } from "./benchProbe";
import type { WtPlayerPort } from "@tentacle-tv/api-client";

/** Ce que le moteur de synchro partagé attend du lecteur (`useGroupSyncEngine`). */
export interface WtTransportSignals {
  notifyBuffering: (buffering: boolean) => void;
  /** `echo` : l'écho d'une commande du moteur, jamais un geste (cf. `notifyPlayState`). */
  notifyPlayState: (paused: boolean, opts?: { echo?: boolean }) => void;
}

/**
 * Le lecteur mobile branché au port Watch Together : un adaptateur
 * (`createMobileTransport`) créé UNE fois, nourri des annonces du moteur
 * (progression, pause, tampon, chargement), et les signaux vers le groupe —
 * « je cale » / « prêt » (`planReadySignal`), lecture / pause relayées une
 * fois le média prêt (les échos sont filtrés par le moteur de synchro).
 *
 * Rend : la ref du port à donner au moteur, la vitesse à poser sur la
 * surface vidéo (`rate`), et `wrapProgress` qui enveloppe le gestionnaire de
 * progression de l'écran (la position est prise À L'INSTANT de l'annonce).
 */
export function useMobileWtTransport({ active, barrier, commands, paused, buffering, videoReady, streamOffset, signals }: {
  /** Une séance est active sur ce média : hors séance, rien ne part. */
  active: boolean;
  /**
   * La salle m'attend sur une cible (barrière) : c'est le MOTEUR qui confirme
   * « posé » (avec le numéro de la barrière). Un « je cale » d'ici le ferait
   * renoncer à la barrière, et le « prêt » qui suivrait n'en porterait pas le
   * numéro — la salle resterait gelée (défaut M1 du banc).
   */
  barrier: boolean;
  commands: Omit<MobileTransportCommands, "setRate">;
  paused: boolean;
  buffering: boolean;
  videoReady: boolean;
  /** Décalage du flux transcodé : la progression du moteur est en position de FLUX. */
  streamOffset: number;
  signals: WtTransportSignals;
}): {
  transportRef: MutableRefObject<WtPlayerPort | null>;
  rate: number;
  wrapProgress: (handler: (data: EngineProgressData) => void) => (data: EngineProgressData) => void;
  /** Le moteur a terminé un saut, en position de FLUX (`onSeekComplete` de la surface). */
  onSeekComplete: (streamSeconds: number) => void;
} {
  const [rate, setRate] = useState(1);
  const commandsRef = useRef(commands);
  commandsRef.current = commands;
  const signalsRef = useRef(signals);
  signalsRef.current = signals;
  const transport = useRef<MobileTransport | null>(null);
  if (transport.current === null) {
    transport.current = createMobileTransport({
      setPaused: (p) => commandsRef.current.setPaused(p),
      seek: (s) => commandsRef.current.seek(s),
      setRate,
      cancelAutoNext: () => commandsRef.current.cancelAutoNext?.(),
    });
  }
  const transportRef = useRef<WtPlayerPort | null>(transport.current);
  const t = transport.current;

  // L'écho d'une pause / lecture commandée par le moteur, lu au même rendu que le relais (plus bas).
  const pausedEchoRef = useRef(false);
  useEffect(() => { pausedEchoRef.current = t.reports.paused(paused); }, [t, paused]);
  useEffect(() => { t.reports.buffering(buffering); }, [t, buffering]);
  useEffect(() => { t.reports.ready(videoReady); }, [t, videoReady]);

  // Hors séance, la vitesse revient à 1 (personne d'autre ne la remettrait).
  useEffect(() => { if (!active) setRate(1); }, [active]);

  // Un saut en vol ne se voit pas forcément atterrir par un rendu (en pause, le
  // moteur se tait) : on se relit tant qu'il vole.
  const seeking = t.isSeeking?.() ?? false;
  const [, recheck] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    if (!seeking) return;
    const timer = setInterval(() => { if (!t.isSeeking?.()) recheck(); }, 250);
    return () => clearInterval(timer);
  }, [t, seeking]);

  // « Je cale » / « prêt » : la règle du bureau, rejouée à chaque changement
  // d'état. Pendant une barrière qui m'attend, jamais « je cale » : le moteur
  // pose et confirme lui-même (« prêt » d'un lecteur encore en chargement à
  // l'armement de la barrière reste permis, sinon personne ne la libérerait).
  useEffect(() => {
    if (!active) return;
    const plan = planReadySignal({ ready: videoReady, buffering, seeking });
    if (!plan || (barrier && plan.buffering)) return;
    const timer = setTimeout(() => signalsRef.current.notifyBuffering(plan.buffering), plan.delayMs);
    return () => clearTimeout(timer);
  }, [active, barrier, videoReady, buffering, seeking]);

  // Lecture / pause relayées une fois le média prêt — les transitoires de
  // chargement ne sont pas des intentions de l'utilisateur. Seulement un
  // CHANGEMENT de pause (comme le bureau) : une séance qui s'ouvre en pleine
  // lecture n'envoie rien à une salle en pause.
  const readyRef = useRef(videoReady);
  readyRef.current = videoReady;
  const activeRef = useRef(active);
  activeRef.current = active;
  useEffect(() => {
    if (activeRef.current && readyRef.current) signalsRef.current.notifyPlayState(paused, { echo: pausedEchoRef.current });
  }, [paused]);
  // À l'instant où le média devient prêt, son état le dit aussi : un lecteur parti en
  // lecture pendant que la salle l'attend y est tenu en pause jusqu'à la reprise
  // commune, au lieu de jouer seul jusqu'à son « prêt » (le moteur en juge).
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  useEffect(() => {
    if (videoReady && activeRef.current) signalsRef.current.notifyPlayState(pausedRef.current);
  }, [videoReady]);

  const offsetRef = useRef(streamOffset);
  offsetRef.current = streamOffset;
  const wrapProgress = useCallback((handler: (data: EngineProgressData) => void) => (data: EngineProgressData) => {
    t.reports.progress(data.currentTime + offsetRef.current);
    if (__DEV__) {
      benchRaw.pos = data.currentTime + offsetRef.current;
      benchRaw.atMs = Date.now();
    }
    handler(data);
  }, [t]);

  const onSeekComplete = useCallback((streamSeconds: number) => {
    t.reports.seekComplete(streamSeconds + offsetRef.current);
    recheck();
  }, [t]);

  return { transportRef, rate, wrapProgress, onSeekComplete };
}
