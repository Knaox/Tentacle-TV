/**
 * Octave — la copie GARDÉE d'abord : un titre gardé sur cet appareil se lit
 * depuis le disque, en ligne comme hors ligne (aucune requête, démarrage
 * immédiat), comme le fait une application de musique avec ses titres gardés.
 *
 * La source porte `kept` : sur le bureau, la coquille cherche elle-même le
 * fichier dans SA base ; sur le mobile, `kept.localUri` le désigne (le moteur y
 * vit, dans le même processus). `url` — le serveur — n'est repris que s'il manque.
 * Sans copie complète, les résolveurs d'avant, inchangés.
 *
 * Consultée à CHAQUE lecture, avant le cache des sources (`SourceCache.kept`) :
 * une source en flux préparée avant l'arrivée de la copie ne passe plus devant.
 */

import { libraryTrackKey, MUSIC_ROUTES, type PlaybackSource } from "@tentacle-tv/shared/music";
import type { SourceResolvers } from "@tentacle-tv/shared/octave";
import type { KeptMusicTrack } from "../core/musicLibrary";

/** La source de la copie gardée ; `url` : le repli du serveur (la bibliothèque, ou la route qui l'a fournie). */
export function keptSource(kept: KeptMusicTrack, userId: string, localUri: string | null = null): PlaybackSource {
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
    kept: localUri === null ? { userId } : { userId, localUri },
  };
}

/** Les résolveurs du lecteur, la copie gardée d'abord (`keptFor` : la source de la copie complète, ou `null`). */
export function withKeptSources(resolvers: SourceResolvers, keptFor: (trackKey: string) => PlaybackSource | null): SourceResolvers {
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
