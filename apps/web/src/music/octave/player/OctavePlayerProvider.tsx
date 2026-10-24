/**
 * Octave — le lecteur de la session musique : UN moteur, UNE file, montés
 * avec le mode et démontés en le quittant (la musique s'arrête en sortant
 * d'Octave : la vidéo reprend sa place).
 *
 * Lecture par sélecteurs (`useSyncExternalStore`) : la barre de progression
 * seule suit la position ; une liste ne se redessine qu'au changement de titre.
 */

import { createContext, useContext, useLayoutEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import type { AudioEnginePort, MusicTrack } from "@tentacle-tv/shared/music";
import { libraryApi } from "../data/libraryApi";
import { externalApi } from "../extension/externalApi";
import { useMusicProviders, type MusicProvider } from "../extension/musicProviders";
import { createOctaveEngine } from "../engine/octaveEngine";
import { OctavePlayer, PlaybackReporter, type PlayerSnapshot, type PositionState, SourceCache } from "@tentacle-tv/shared/octave";

const PlayerContext = createContext<OctavePlayer | null>(null);

const VOLUME_KEY = "tentacle_octave_volume";

function readVolume(): number | null {
  try {
    const v = Number(localStorage.getItem(VOLUME_KEY));
    return Number.isFinite(v) && v >= 0 && v <= 1 && localStorage.getItem(VOLUME_KEY) !== null ? v : null;
  } catch {
    return null;
  }
}

/** Les extensions du moment, lues sans recréer le lecteur à chaque rendu. */
const providersRef: { current: readonly MusicProvider[] } = { current: [] };

function providerOf(track: MusicTrack): MusicProvider | null {
  const pluginId = track.external?.pluginId;
  return pluginId ? (providersRef.current.find((p) => p.pluginId === pluginId) ?? null) : null;
}

export function buildOctavePlayer(engine: AudioEnginePort): OctavePlayer {
  const sources = new SourceCache({
    library: (id) => libraryApi.source(id),
    external: async (track) => {
      const provider = providerOf(track);
      if (!provider || !track.external) return null;
      const res = await externalApi.resolve(provider, [track.external.id]);
      return res.sources.find((s) => s.externalId === track.external?.id)?.source ?? null;
    },
    now: () => Date.now(),
  });
  const reporter = new PlaybackReporter({
    library: (report) => void libraryApi.report(report).catch(() => undefined),
    externalPlayed: (track, completed) => {
      const provider = providerOf(track);
      if (provider && track.external) externalApi.played(provider, track.external.id, completed);
    },
    now: () => Date.now(),
  });
  return new OctavePlayer({
    engine,
    sources,
    reporter,
    prefetchExternal: (tracks, intent) => {
      const byProvider = new Map<MusicProvider, string[]>();
      for (const t of tracks) {
        const p = providerOf(t);
        if (p && t.external && t.availability !== "library") byProvider.set(p, [...(byProvider.get(p) ?? []), t.external.id]);
      }
      for (const [p, ids] of byProvider) externalApi.prefetch(p, ids, intent);
    },
  });
}

export function OctavePlayerProvider({ children, engineFactory = createOctaveEngine }: { children: ReactNode; engineFactory?: () => AudioEnginePort }) {
  const providers = useMusicProviders();
  providersRef.current = providers;
  const [player, setPlayer] = useState<OctavePlayer | null>(null);
  // Créé dans un effet de mise en page (StrictMode monte deux fois : chaque
  // montage a SON moteur, rendu avant la première image — aucun écran vide).
  useLayoutEffect(() => {
    const p = buildOctavePlayer(engineFactory());
    const volume = readVolume();
    if (volume !== null) p.setVolume(volume);
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
      p.deps.engine.dispose();
    };
  }, [engineFactory]);
  if (!player) return null;
  return <PlayerContext.Provider value={player}>{children}</PlayerContext.Provider>;
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
