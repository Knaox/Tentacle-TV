/**
 * Octave — la copie GARDÉE d'abord (règle commune : `@tentacle-tv/offline-core/music`,
 * `keptSources.ts`) : la source porte `kept`, la coquille cherche elle-même le
 * fichier dans SA base (la page ne désigne jamais un chemin) et ne reprend `url` —
 * le serveur — que s'il manque.
 */

import { keptSource, withKeptSources as withKept } from "@tentacle-tv/offline-core/music";
import type { PlaybackSource } from "@tentacle-tv/shared/music";
import type { SourceResolvers } from "@tentacle-tv/shared/octave";
import { completeKeptTrack, keptMusicState } from "./keptMusicStore";

export { keptSource };

/** La source de la copie complète de ce titre, gardée par le compte de l'appareil ; `null` sinon. */
export function keptFor(trackKey: string): PlaybackSource | null {
  const userId = keptMusicState().userId;
  const kept = userId === null ? null : completeKeptTrack(trackKey);
  return kept && userId !== null ? keptSource(kept, userId) : null;
}

/** Les résolveurs du lecteur, la copie gardée d'abord. */
export function withKeptSources(resolvers: SourceResolvers): SourceResolvers {
  return withKept(resolvers, keptFor);
}
