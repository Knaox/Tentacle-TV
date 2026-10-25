/**
 * Octave — les appels aux routes MUSIQUE du cœur (`MUSIC_ROUTES`, contrat
 * `@tentacle-tv/shared/music`), par le même transport que les préférences
 * (`tentacleApiFetch` : même base, même jeton, cookie sur le web). Aucune
 * logique ici : les crochets (`useMusic*`) gardent, mettent en cache, invalident.
 */

import {
  MUSIC_ROUTES,
  type MusicAlbum,
  type MusicAlbumPage,
  type MusicArtistPage,
  type MusicArtistResponse,
  type MusicByMbidResponse,
  type MusicHomeResponse,
  type MusicLikedPage,
  type MusicMatchRequest,
  type MusicMatchResponse,
  type MusicPlaybackReport,
  type MusicPlaylist,
  type MusicPlaylistDetail,
  type MusicSearchResponse,
  type MusicSourceResponse,
  type MusicStatus,
} from "@tentacle-tv/shared/music";
import { tentacleApiFetch } from "../hooks/usePreferences";

export type MusicAlbumSort = "name" | "recent" | "year";

function at(route: string, params: Record<string, string>): string {
  return Object.entries(params).reduce((path, [name, value]) => path.replace(`:${name}`, encodeURIComponent(value)), route);
}

function query(params: Record<string, string | number | null | undefined>): string {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`);
  return parts.length > 0 ? `?${parts.join("&")}` : "";
}

const json = (method: string, body: unknown, signal?: AbortSignal): RequestInit => ({ method, body: JSON.stringify(body), signal });

export const musicApi = {
  status: (signal?: AbortSignal) => tentacleApiFetch<MusicStatus>(MUSIC_ROUTES.status, { signal }),
  search: (q: string, limit: number, signal?: AbortSignal) =>
    tentacleApiFetch<MusicSearchResponse>(`${MUSIC_ROUTES.search}${query({ q, limit })}`, { signal }),
  albums: (cursor: string | null, limit: number, sort: MusicAlbumSort, signal?: AbortSignal) =>
    tentacleApiFetch<MusicAlbumPage>(`${MUSIC_ROUTES.albums}${query({ cursor, limit, sort })}`, { signal }),
  album: (id: string, signal?: AbortSignal) => tentacleApiFetch<MusicAlbum>(at(MUSIC_ROUTES.album, { id }), { signal }),
  artists: (cursor: string | null, limit: number, signal?: AbortSignal) =>
    tentacleApiFetch<MusicArtistPage>(`${MUSIC_ROUTES.artists}${query({ cursor, limit })}`, { signal }),
  artist: (id: string, signal?: AbortSignal) => tentacleApiFetch<MusicArtistResponse>(at(MUSIC_ROUTES.artist, { id }), { signal }),
  home: (signal?: AbortSignal) => tentacleApiFetch<MusicHomeResponse>(MUSIC_ROUTES.home, { signal }),
  liked: (cursor: string | null, limit: number, signal?: AbortSignal) =>
    tentacleApiFetch<MusicLikedPage>(`${MUSIC_ROUTES.liked}${query({ cursor, limit })}`, { signal }),
  setFavorite: (id: string, favorite: boolean) =>
    tentacleApiFetch<{ jellyfinId: string; favorite: boolean }>(at(MUSIC_ROUTES.favorite, { id }), json("PUT", { favorite })),
  playlists: (signal?: AbortSignal) => tentacleApiFetch<MusicPlaylist[]>(MUSIC_ROUTES.playlists, { signal }),
  createPlaylist: (name: string, itemIds: string[]) =>
    tentacleApiFetch<MusicPlaylistDetail>(MUSIC_ROUTES.playlists, json("POST", { name, itemIds })),
  playlist: (id: string, signal?: AbortSignal) => tentacleApiFetch<MusicPlaylistDetail>(at(MUSIC_ROUTES.playlist, { id }), { signal }),
  renamePlaylist: (id: string, name: string) =>
    tentacleApiFetch<MusicPlaylistDetail>(at(MUSIC_ROUTES.playlist, { id }), json("PATCH", { name })),
  deletePlaylist: (id: string) => tentacleApiFetch<{ ok: true }>(at(MUSIC_ROUTES.playlist, { id }), { method: "DELETE" }),
  insertEntries: (id: string, itemIds: string[], position?: number) =>
    tentacleApiFetch<MusicPlaylistDetail>(at(MUSIC_ROUTES.playlistEntries, { id }), json("POST", { itemIds, position })),
  moveEntry: (id: string, entryId: string, position: number) =>
    tentacleApiFetch<MusicPlaylistDetail>(at(MUSIC_ROUTES.playlistEntry, { id, entryId }), json("PATCH", { position })),
  removeEntry: (id: string, entryId: string) =>
    tentacleApiFetch<MusicPlaylistDetail>(at(MUSIC_ROUTES.playlistEntry, { id, entryId }), { method: "DELETE" }),
  byMbid: (recordings: string[], signal?: AbortSignal) =>
    tentacleApiFetch<MusicByMbidResponse>(MUSIC_ROUTES.byMbid, json("POST", { recordings }, signal)),
  match: (request: MusicMatchRequest, signal?: AbortSignal) =>
    tentacleApiFetch<MusicMatchResponse>(MUSIC_ROUTES.match, json("POST", request, signal)),
  source: (id: string, signal?: AbortSignal) => tentacleApiFetch<MusicSourceResponse>(at(MUSIC_ROUTES.source, { id }), { signal }),
  playback: (report: MusicPlaybackReport) =>
    tentacleApiFetch<{ ok: boolean }>(MUSIC_ROUTES.playback, { ...json("POST", report), keepalive: true }),
};
