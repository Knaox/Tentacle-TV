/**
 * Octave — l'ADAPTATEUR de la bibliothèque musique du cœur (`/api/music/*`,
 * contrat musicCoreApi.ts).
 *
 * Provisoire et remplaçable : les crochets officiels viennent de l'api-client
 * (`packages/api-client/src/music/*`, agent 3). Tant qu'ils n'existent pas,
 * l'interface parle aux routes du contrat par ces fonctions, et par elles
 * seules — l'intégration n'aura qu'à rebrancher ce fichier et `libraryQueries.ts`.
 */

import { notificationsBackendRoot, tentacleApiFetch } from "@tentacle-tv/api-client";
import {
  MUSIC_ROUTES,
  type MusicAlbum,
  type MusicAlbumPage,
  type MusicArtistPage,
  type MusicArtistResponse,
  type MusicByMbidResponse,
  type MusicHomeResponse,
  type MusicLikedPage,
  type MusicPlaybackReport,
  type MusicPlaylist,
  type MusicPlaylistDetail,
  type MusicSearchResponse,
  type MusicSourceResponse,
  type MusicStatus,
} from "@tentacle-tv/shared/music";

/** `/api/music/albums/:id` → `/api/music/albums/abc`. */
export function musicPath(route: string, params: Record<string, string> = {}): string {
  return route.replace(/:(\w+)/g, (_, name: string) => encodeURIComponent(params[name] ?? ""));
}

function withQuery(path: string, query: Record<string, string | number | null | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== null && value !== undefined && value !== "") params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

/** Une URL du serveur Tentacle rendue absolue (bureau : autre origine). Les URL https d'une extension restent telles quelles. */
export function serverUrl(path: string | null): string | null {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  return `${notificationsBackendRoot()}${path}`;
}

/**
 * Un geste sans réponse utile : une 204 n'a pas de JSON, et `tentacleApiFetch`
 * le lit toujours — seule cette erreur d'analyse est un succès.
 */
export function fetchVoid(path: string, init?: RequestInit): Promise<void> {
  return tentacleApiFetch<unknown>(path, init).then(
    () => undefined,
    (error: unknown) => {
      if (error instanceof SyntaxError) return undefined;
      throw error;
    },
  );
}

export const libraryApi = {
  status: () => tentacleApiFetch<MusicStatus>(MUSIC_ROUTES.status),
  home: () => tentacleApiFetch<MusicHomeResponse>(MUSIC_ROUTES.home),
  search: (q: string, limit = 20, signal?: AbortSignal) =>
    tentacleApiFetch<MusicSearchResponse>(withQuery(MUSIC_ROUTES.search, { q, limit }), { signal }),
  albums: (cursor: string | null, sort: string, limit = 60) =>
    tentacleApiFetch<MusicAlbumPage>(withQuery(MUSIC_ROUTES.albums, { cursor, sort, limit })),
  album: (id: string) => tentacleApiFetch<MusicAlbum>(musicPath(MUSIC_ROUTES.album, { id })),
  artists: (cursor: string | null, limit = 60) =>
    tentacleApiFetch<MusicArtistPage>(withQuery(MUSIC_ROUTES.artists, { cursor, limit })),
  artist: (id: string) => tentacleApiFetch<MusicArtistResponse>(musicPath(MUSIC_ROUTES.artist, { id })),
  liked: (cursor: string | null) => tentacleApiFetch<MusicLikedPage>(withQuery(MUSIC_ROUTES.liked, { cursor })),
  setFavorite: (id: string, favorite: boolean) =>
    fetchVoid(musicPath(MUSIC_ROUTES.favorite, { id }), { method: "PUT", body: JSON.stringify({ favorite }) }),
  playlists: () => tentacleApiFetch<MusicPlaylist[]>(MUSIC_ROUTES.playlists),
  createPlaylist: (name: string, itemIds: string[] = []) =>
    tentacleApiFetch<MusicPlaylist>(MUSIC_ROUTES.playlists, { method: "POST", body: JSON.stringify({ name, itemIds }) }),
  playlist: (id: string) => tentacleApiFetch<MusicPlaylistDetail>(musicPath(MUSIC_ROUTES.playlist, { id })),
  addToPlaylist: (id: string, itemIds: string[], position?: number) =>
    fetchVoid(musicPath(MUSIC_ROUTES.playlistEntries, { id }), {
      method: "POST",
      body: JSON.stringify(position === undefined ? { itemIds } : { itemIds, position }),
    }),
  moveEntry: (id: string, entryId: string, position: number) =>
    fetchVoid(musicPath(MUSIC_ROUTES.playlistEntry, { id, entryId }), { method: "PATCH", body: JSON.stringify({ position }) }),
  removeEntry: (id: string, entryId: string) =>
    fetchVoid(musicPath(MUSIC_ROUTES.playlistEntry, { id, entryId }), { method: "DELETE" }),
  byMbid: (recordings: string[]) =>
    tentacleApiFetch<MusicByMbidResponse>(MUSIC_ROUTES.byMbid, { method: "POST", body: JSON.stringify({ recordings }) }),
  source: (id: string) => tentacleApiFetch<MusicSourceResponse>(musicPath(MUSIC_ROUTES.source, { id })),
  report: (report: MusicPlaybackReport) =>
    fetchVoid(MUSIC_ROUTES.playback, { method: "POST", body: JSON.stringify(report) }),
};

export type LibraryApi = typeof libraryApi;
