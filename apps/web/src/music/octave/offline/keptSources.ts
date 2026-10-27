/**
 * Octave — la copie GARDÉE d'abord : un titre gardé sur cet appareil se lit
 * depuis le disque, en ligne comme hors ligne (aucune requête, démarrage
 * immédiat), comme le fait une application de musique avec ses titres gardés.
 *
 * La source porte `kept` : la coquille cherche elle-même le fichier dans SA
 * base (la page ne désigne jamais un chemin) et ne reprend `url` — le serveur —
 * que s'il manque. Sans copie complète, les résolveurs d'avant, inchangés.
 *
 * Consultée à CHAQUE lecture, avant le cache des sources (`SourceCache.kept`) :
 * une source en flux préparée avant l'arrivée de la copie ne passe plus devant.
 */

import type { KeptMusicTrack } from "@tentacle-tv/offline-core";
import { libraryTrackKey, MUSIC_ROUTES, type PlaybackSource } from "@tentacle-tv/shared/music";
import type { SourceResolvers } from "@tentacle-tv/shared/octave";
import { completeKeptTrack, keptMusicState } from "./keptMusicStore";

/** La source de la copie gardée ; `url` : le repli du serveur (la bibliothèque, ou la route qui l'a fournie). */
export function keptSource(kept: KeptMusicTrack, userId: string): PlaybackSource {
  const fallback = kept.origin === "library" ? MUSIC_ROUTES.stream.replace(":id", kept.itemId) : (kept.sourcePath ?? "");
  return {
    trackKey: kept.trackKey,
    url: fallback,
    origin: kept.origin === "library" ? "library" : "plugin",
    complete: true,
    sizeBytes: kept.expectedSize,
    durationMs: kept.durationMs,
    format: null,
    replayGain: null,
    expiresAt: null,
    kept: { userId },
  };
}

/** La source de la copie complète de ce titre, gardée par le compte de l'appareil ; `null` sinon. */
export function keptFor(trackKey: string): PlaybackSource | null {
  const userId = keptMusicState().userId;
  const kept = userId === null ? null : completeKeptTrack(trackKey);
  return kept && userId !== null ? keptSource(kept, userId) : null;
}

/** Les résolveurs du lecteur, la copie gardée d'abord. */
export function withKeptSources(resolvers: SourceResolvers): SourceResolvers {
  return {
    ...resolvers,
    kept: keptFor,
    library: (jellyfinId) => {
      const kept = keptFor(libraryTrackKey(jellyfinId));
      return kept ? Promise.resolve(kept) : resolvers.library(jellyfinId);
    },
    external: (track, intent) => {
      const kept = keptFor(track.key);
      return kept ? Promise.resolve(kept) : resolvers.external(track, intent);
    },
  };
}
