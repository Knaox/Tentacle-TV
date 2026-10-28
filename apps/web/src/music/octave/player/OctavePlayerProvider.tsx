/**
 * Octave — le lecteur de la session musique : le MOTEUR d'A2
 * (`AudioEngineProvider` : mpv en audio seul sur le bureau, Web Audio sur le
 * web) et la FILE (`OctavePlayer`, shared/octave), montés avec le mode et
 * démontés en le quittant (la musique s'arrête en sortant d'Octave).
 *
 * Les sources : la bibliothèque par le cache d'A3 (`fetchMusicSource`, une
 * requête par titre), l'extension par A5 (`resolveMusicSource`) ; la couche
 * `SourceCache` (shared) ne fait que les rendre disponibles SYNCHRONEMENT
 * (`peek`), pour lancer le son dans le tour même du clic.
 *
 * Lecture par sélecteurs (`useSyncExternalStore`) : la barre de progression
 * seule suit la position ; une liste ne se redessine qu'au changement de titre.
 */

import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { buildOctavePlayer as buildSharedOctavePlayer, followSearchWithRadio, useServerCapability, type MusicProvider } from "@tentacle-tv/api-client";
import type { AudioEnginePort } from "@tentacle-tv/shared/music";
import type { OctavePlayer, PlayerSnapshot, PositionState } from "@tentacle-tv/shared/octave";
import { AudioEngineProvider, useAudioEngine, type EnginePrefs } from "../../engine";
import { attachPlayerResume } from "../cache/playerResume";
import { octaveOwner } from "../cache/octaveOwner";
import { useOctaveProvider } from "../mode/useOctaveProvider";
import { keptFor, withKeptSources } from "../offline/keptSources";
import { attachSessionRemote, type SessionRemote } from "./octaveSessionRemote";

const PlayerContext = createContext<OctavePlayer | null>(null);

const VOLUME_KEY = "tentacle_octave_volume";

function readVolume(): number {
  try {
    const raw = localStorage.getItem(VOLUME_KEY);
    const v = raw === null ? Number.NaN : Number(raw);
    return Number.isFinite(v) && v >= 0 && v <= 1 ? v : 1;
  } catch {
    return 1;
  }
}

/** La file d'Octave sur ce moteur : la fabrique partagée (api-client), la copie gardée du bureau d'abord. */
export function buildOctavePlayer(engine: AudioEnginePort, qc: QueryClient, provider: () => MusicProvider | null): OctavePlayer {
  return buildSharedOctavePlayer(engine, qc, provider, { wrapSources: withKeptSources, isKept: (key) => keptFor(key) !== null });
}

/** La file, sur le moteur démarré par A2 (un moteur neuf → une file neuve). */
function PlayerOnEngine({ children }: { children: ReactNode }) {
  const engine = useAudioEngine();
  const qc = useQueryClient();
  const provider = useOctaveProvider();
  const providerRef = useRef(provider);
  providerRef.current = provider;
  const declaresRef = useRef(false);
  const declares = useServerCapability("sessions.musicControl");
  declaresRef.current = declares;
  const remoteRef = useRef<SessionRemote | null>(null);
  const [player, setPlayer] = useState<OctavePlayer | null>(null);
  // La capacité connue après la reprise (configuration en route) : l'écoute se dit aussitôt.
  useEffect(() => remoteRef.current?.resync(), [declares]);

  useLayoutEffect(() => {
    if (!engine) return;
    const p = buildOctavePlayer(engine, qc, () => providerRef.current);
    // Le volume survit d'une session à l'autre (préférence d'appareil).
    let lastVolume = p.snapshot.get().volume;
    const off = p.snapshot.subscribe(() => {
      const v = p.snapshot.get().volume;
      if (v === lastVolume) return;
      lastVolume = v;
      try {
        localStorage.setItem(VOLUME_KEY, String(v));
      } catch {
        /* stockage refusé */
      }
    });
    // S3 : après le premier son d'un titre de recherche, sa radio devient la suite.
    const offRadio = followSearchWithRadio(p, () => providerRef.current);
    // Les sessions en cours de l'administration : ce qui joue s'y dit, et s'y commande.
    const remote = attachSessionRemote(p, () => declaresRef.current);
    remoteRef.current = remote;
    // La session quittée revient en pause (dernier titre, file, position) ; gardée AVANT l'arrêt du lecteur.
    const offResume = attachPlayerResume(p, octaveOwner());
    setPlayer(p);
    return () => {
      off();
      offRadio();
      remote.detach();
      remoteRef.current = null;
      offResume();
      p.dispose();
      setPlayer(null);
    };
  }, [engine, qc]);

  if (!player) return null;
  return <PlayerContext.Provider value={player}>{children}</PlayerContext.Provider>;
}

/** Les réglages de départ du moteur d'Octave (le volume survit d'une session à l'autre). */
export function octaveEnginePrefs(): EnginePrefs {
  return { volume: readVolume(), muted: false, replayGain: "auto", deviceId: null, exclusive: false };
}

export function OctavePlayerProvider({ children }: { children: ReactNode }) {
  const [prefs] = useState<EnginePrefs>(octaveEnginePrefs);
  return (
    <AudioEngineProvider prefs={prefs}>
      <PlayerOnEngine>{children}</PlayerOnEngine>
    </AudioEngineProvider>
  );
}

export function useOctavePlayer(): OctavePlayer {
  const player = useContext(PlayerContext);
  if (!player) throw new Error("useOctavePlayer hors d'OctavePlayerProvider");
  return player;
}

/** Une tranche de l'instantané : le composant ne se redessine que si elle change. */
export function usePlayerSelector<T>(select: (s: PlayerSnapshot) => T): T {
  const player = useOctavePlayer();
  const read = () => select(player.snapshot.get());
  return useSyncExternalStore(player.snapshot.subscribe, read, read);
}

export function usePlayerPosition(): PositionState {
  const player = useOctavePlayer();
  return useSyncExternalStore(player.position.subscribe, player.position.get, player.position.get);
}

/** La clé du titre en cours (ou `null`) — pour marquer « en lecture » dans les listes. */
export function useCurrentKey(): string | null {
  return usePlayerSelector((s) => s.current?.key ?? null);
}
