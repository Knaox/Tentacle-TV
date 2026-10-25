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

import { createContext, useContext, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import {
  fetchMusicSource,
  prefetchMusic,
  reportExternalPlayed,
  reportMusicPlayback,
  resolveMusicSource,
  type MusicProvider,
} from "@tentacle-tv/api-client";
import type { AudioEnginePort } from "@tentacle-tv/shared/music";
import { OctavePlayer, PlaybackReporter, SourceCache, type PlayerSnapshot, type PositionState } from "@tentacle-tv/shared/octave";
import { AudioEngineProvider, useAudioEngine, type EnginePrefs } from "../../engine";
import { isFromProvider, useOctaveProvider } from "../mode/useOctaveProvider";

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

export function buildOctavePlayer(engine: AudioEnginePort, qc: QueryClient, provider: () => MusicProvider | null): OctavePlayer {
  const sources = new SourceCache({
    library: (id) => fetchMusicSource(qc, id),
    external: async (track, intent) => {
      const p = provider();
      if (!track.external || !isFromProvider(p, track.external.pluginId)) return null;
      // Sans source parce que le budget de l'extension est atteint : le lecteur réessaiera (contrat `retry`).
      // Le préchargement du suivant se dit : l'extension le fait passer après les gestes.
      const outcome = await resolveMusicSource(p, track.external.id, undefined, intent === "next" ? "next" : undefined);
      return outcome === null ? null : "source" in outcome ? outcome.source : outcome;
    },
    now: () => Date.now(),
  });
  const reporter = new PlaybackReporter({
    library: (report) => void reportMusicPlayback(report),
    externalPlayed: (track, completed) => {
      const p = provider();
      if (track.external && isFromProvider(p, track.external.pluginId)) reportExternalPlayed(p, track.external.id, completed);
    },
    now: () => Date.now(),
  });
  return new OctavePlayer({
    engine,
    sources,
    reporter,
    prefetchExternal: (tracks, intent) => {
      const p = provider();
      if (!p) return;
      const ids = tracks.filter((t) => t.availability !== "library" && t.external && isFromProvider(p, t.external.pluginId)).map((t) => t.external!.id);
      prefetchMusic(p, ids, intent);
    },
  });
}

/** La file, sur le moteur démarré par A2 (un moteur neuf → une file neuve). */
function PlayerOnEngine({ children }: { children: ReactNode }) {
  const engine = useAudioEngine();
  const qc = useQueryClient();
  const provider = useOctaveProvider();
  const providerRef = useRef(provider);
  providerRef.current = provider;
  const [player, setPlayer] = useState<OctavePlayer | null>(null);

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
    setPlayer(p);
    return () => {
      off();
      p.dispose();
      setPlayer(null);
    };
  }, [engine, qc]);

  if (!player) return null;
  return <PlayerContext.Provider value={player}>{children}</PlayerContext.Provider>;
}

export function OctavePlayerProvider({ children }: { children: ReactNode }) {
  const [prefs] = useState<EnginePrefs>(() => ({ volume: readVolume(), muted: false, replayGain: "auto", deviceId: null, exclusive: false }));
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
