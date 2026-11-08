/**
 * Octave — la FILE d'une session musique sur un moteur (`AudioEnginePort`) : les sources (bibliothèque par
 * `fetchMusicSource`, extension par `resolveMusicSource`), le rapport d'écoute et l'anticipation des extensions.
 * La même pour le web, le bureau et le mobile ; chaque client ne branche que son moteur et, s'il en a une,
 * sa copie GARDÉE sur l'appareil (`kept` : consultée avant le cache des sources, hors ligne compris).
 */

import type { QueryClient } from "@tanstack/react-query";
import type { AudioEnginePort, MusicTrack } from "@tentacle-tv/shared/music";
import { OctavePlayer, PlaybackReporter, setKeptPlayabilityLookup, type SourceResolvers } from "@tentacle-tv/shared/octave";
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

/** Le rythme du rapport d'écoute (mobile seulement ; web et bureau n'en passent pas : la cadence d'avant). */
export interface OctaveReportPacing {
  /** L'app est derrière (écran éteint, autre app) : la progression passe de 15 s à 60 s (`playbackReports.ts`). */
  background?: () => boolean;
  /** Reçoit le battement du rapporteur, à appeler à chaque ping du socket (`socketReportPacing.ts`). */
  onBeat?: (beat: () => void) => void;
}

// Ce titre vient-il de CETTE extension ? Une seule règle (`pluginMusic/musicProvider.ts`).
export { isFromMusicProvider };

export function buildOctavePlayer(
  engine: AudioEnginePort,
  qc: QueryClient,
  provider: () => MusicProvider | null,
  kept: OctaveKeptPort = {},
  pacing: OctaveReportPacing = {},
): OctavePlayer {
  // Un titre gardé n'est jamais grisé ni sauté, même refusé par sa source (lot « ol », `playabilityPatch.ts`).
  setKeptPlayabilityLookup(kept.isKept ?? null);
  const resolvers: SourceResolvers = {
    library: (id) => fetchMusicSource(qc, id),
    external: async (track: MusicTrack, intent) => {
      const p = provider();
      if (!track.external || !isFromMusicProvider(p, track.external.pluginId)) return null;
      // Sans source parce que le budget de l'extension est atteint : le lecteur réessaiera (contrat `retry`).
      // Le préchargement du suivant se dit (l'extension le fait passer après les gestes), « Réessayer » aussi.
      const outcome = await resolveMusicSource(p, track.external.id, undefined, intent === "play" ? undefined : intent);
      // Refusé par la source (lot « ol ») : le lecteur le grise et passe au suivant, sans échec rouge.
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
    ...(pacing.background ? { background: pacing.background } : {}),
  });
  pacing.onBeat?.(() => reporter.beat());
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
