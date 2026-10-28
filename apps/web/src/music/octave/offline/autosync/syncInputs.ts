/**
 * Octave — ce que la tenue à jour demande au serveur (règle commune :
 * `@tentacle-tv/offline-core/music`, `syncInputs.ts`), branché ici sur les
 * requêtes d'api-client.
 */

import type { KeptMusicCollection, KeptMusicTrack } from "@tentacle-tv/offline-core";
import { readPendingWith, readPlaylistsWith, readTwinsWith, readWantedWith, type SyncReadApi, type WantedForm } from "@tentacle-tv/offline-core/music";
import { fetchExternalPlaylist, fetchPendingMusic, libraryMatchRequest, musicApi, type MusicProvider } from "@tentacle-tv/api-client";
import type { MusicTrack, PendingMusicItem } from "@tentacle-tv/shared/music";
import { planLibrary } from "../keepMusic";

export { playlistTarget } from "@tentacle-tv/offline-core/music";

/** Les requêtes de la tenue à jour (celles d'api-client), aussi données à l'exécutant (`useKeptAutoSync`). */
export const syncReadApi: SyncReadApi<MusicProvider> = {
  playlist: (id) => musicApi.playlist(id),
  externalPlaylist: (provider, id) => fetchExternalPlaylist(provider, id),
  pending: (provider) => fetchPendingMusic(provider),
  matchRequest: (tracks) => libraryMatchRequest(tracks, []),
  match: (request) => musicApi.match(request),
  plan: async (body) => ({ tracks: [...(await planLibrary(body.ids)).values()], refused: [] }),
  liked: (cursor, limit) => musicApi.liked(cursor, limit),
};

export function readPending(provider: MusicProvider | null): Promise<PendingMusicItem[] | null> {
  return readPendingWith(syncReadApi, provider);
}

export function readPlaylists(
  collections: readonly KeptMusicCollection[],
  provider: MusicProvider | null,
  only: ReadonlySet<string> | null = null,
  pending: readonly PendingMusicItem[] | null = null,
): Promise<Map<string, MusicTrack[]>> {
  return readPlaylistsWith(syncReadApi, collections, provider, only, pending);
}

export function readTwins(kept: readonly KeptMusicTrack[]): Promise<Map<string, MusicTrack>> {
  return readTwinsWith(syncReadApi, kept);
}

export function readWanted(kept: readonly KeptMusicTrack[]): Promise<Map<string, WantedForm>> {
  return readWantedWith(syncReadApi, kept);
}
