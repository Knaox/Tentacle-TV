import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import type { EngineProgressData } from "@/player/engine/types";
import { createMobileTransport, type MobileTransport, type MobileTransportCommands } from "./mobileTransport";
import { planReadySignal } from "./readySignal";
import type { WtPlayerPort } from "./wtPlayerPort";

/** Ce que le moteur de synchro partagé attend du lecteur (`useGroupSyncEngine`). */
export interface WtTransportSignals {
  notifyBuffering: (buffering: boolean) => void;
  notifyPlayState: (paused: boolean) => void;
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
export function useMobileWtTransport({ active, commands, paused, buffering, videoReady, streamOffset, signals }: {
  /** Une séance est active sur ce média : hors séance, rien ne part. */
  active: boolean;
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

  useEffect(() => { t.reports.paused(paused); }, [t, paused]);
  useEffect(() => { t.reports.buffering(buffering); }, [t, buffering]);
  useEffect(() => { t.reports.ready(videoReady); }, [t, videoReady]);

  // Hors séance, la vitesse revient à 1 (personne d'autre ne la remettrait).
  useEffect(() => { if (!active) setRate(1); }, [active]);

  // « Je cale » / « prêt » : la règle du bureau, rejouée à chaque changement d'état.
  const seeking = t.isSeeking?.() ?? false;
  useEffect(() => {
    if (!active) return;
    const plan = planReadySignal({ ready: videoReady, buffering, seeking });
    if (!plan) return;
    const timer = setTimeout(() => signalsRef.current.notifyBuffering(plan.buffering), plan.delayMs);
    return () => clearTimeout(timer);
  }, [active, videoReady, buffering, seeking]);

  // Lecture / pause relayées une fois le média prêt — les transitoires de
  // chargement ne sont pas des intentions de l'utilisateur.
  const readyRef = useRef(videoReady);
  readyRef.current = videoReady;
  useEffect(() => {
    if (active && readyRef.current) signalsRef.current.notifyPlayState(paused);
  }, [active, paused]);

  const offsetRef = useRef(streamOffset);
  offsetRef.current = streamOffset;
  const wrapProgress = useCallback((handler: (data: EngineProgressData) => void) => (data: EngineProgressData) => {
    t.reports.progress(data.currentTime + offsetRef.current);
    handler(data);
  }, [t]);

  return { transportRef, rate, wrapProgress };
}
