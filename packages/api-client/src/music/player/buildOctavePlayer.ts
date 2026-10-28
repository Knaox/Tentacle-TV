/**
 * Octave — la FILE d'une session musique sur un moteur (`AudioEnginePort`) : les sources (bibliothèque par
 * `fetchMusicSource`, extension par `resolveMusicSource`), le rapport d'écoute et l'anticipation des extensions.
 * La même pour le web, le bureau et le mobile ; chaque client ne branche que son moteur et, s'il en a une,
 * sa copie GARDÉE sur l'appareil (`kept` : consultée avant le cache des sources, hors ligne compris).
 */

import type { QueryClient } from "@tanstack/react-query";
import type { AudioEnginePort, MusicTrack } from "@tentacle-tv/shared/music";
import { OctavePlayer, PlaybackReporter, type SourceResolvers } from "@tentacle-tv/shared/octave";
import { fetchMusicSource } from "../useMusicLibrary";
import { reportMusicPlayback } from "../musicPlaybackReport";
import { prefetchMusic, reportExternalPlayed, resolveMusicSource } from "../../pluginMusic/musicRequests";
import { isFromMusicProvider, type MusicProvider } from "../../pluginMusic/musicProvider";
import { retainedSourceCache } from "./retainedSources";

export interface OctaveKeptPort {
  /** Enveloppe les résolveurs : la copie gardée d'abord (web : `withKeptSources`). */
  wrapSources?: (resolvers: SourceResolvers) => SourceResolvers;
  /** Ce titre a-t-il une copie gardée (rien à préparer chez l'extension) ? */
  isKept?: (trackKey: string) => boolean;
  /**
   * Garder les sources résolues au-delà de CE lecteur, pour ce propriétaire (serveur + compte) : un lecteur
   * remonté (retour dans Octave, mobile) les retrouve (`retainedSources.ts`). Absent : un cache à lui seul.
   */
  retainSourcesFor?: string | null;
}

// Ce titre vient-il de CETTE extension ? Une seule règle (`pluginMusic/musicProvider.ts`).
export { isFromMusicProvider };

export function buildOctavePlayer(
  engine: AudioEnginePort,
  qc: QueryClient,
  provider: () => MusicProvider | null,
  kept: OctaveKeptPort = {},
): OctavePlayer {
  const resolvers: SourceResolvers = {
    library: (id) => fetchMusicSource(qc, id),
    external: async (track: MusicTrack, intent) => {
      const p = provider();
      if (!track.external || !isFromMusicProvider(p, track.external.pluginId)) return null;
      // Sans source parce que le budget de l'extension est atteint : le lecteur réessaiera (contrat `retry`).
      // Le préchargement du suivant se dit (l'extension le fait passer après les gestes), « Réessayer » aussi.
      const outcome = await resolveMusicSource(p, track.external.id, undefined, intent === "play" ? undefined : intent);
      return outcome === null ? null : "source" in outcome ? outcome.source : outcome;
    },
    now: () => Date.now(),
  };
  const sources = retainedSourceCache(kept.retainSourcesFor ?? null, kept.wrapSources ? kept.wrapSources(resolvers) : resolvers);
  const reporter = new PlaybackReporter({
    library: (report) => void reportMusicPlayback(report),
    externalPlayed: (track, completed) => {
      const p = provider();
      if (track.external && isFromMusicProvider(p, track.external.pluginId)) reportExternalPlayed(p, track.external.id, completed);
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
      // Un titre gardé sur l'appareil se lit depuis le disque : rien à préparer chez l'extension.
      const ids = tracks
        .filter((t) => t.availability !== "library" && t.external && isFromMusicProvider(p, t.external.pluginId) && !kept.isKept?.(t.key))
        .map((t) => t.external!.id);
      prefetchMusic(p, ids, intent);
    },
  });
}
