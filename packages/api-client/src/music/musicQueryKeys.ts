/**
 * Octave — les clés de cache de la musique, toutes sous `["music"]` : un
 * évènement `music:*` sait ce qu'il doit relire sans connaître les écrans.
 */

import type { MusicAlbumSort } from "./musicApi";

export const MUSIC_KEY = ["music"] as const;

export const musicKeys = {
  status: () => ["music", "status"] as const,
  search: (q: string, limit: number) => ["music", "search", q, limit] as const,
  albums: (sort: MusicAlbumSort, limit: number) => ["music", "albums", sort, limit] as const,
  album: (id: string) => ["music", "album", id] as const,
  artists: (limit: number) => ["music", "artists", limit] as const,
  artist: (id: string) => ["music", "artist", id] as const,
  home: () => ["music", "home"] as const,
  liked: (limit: number) => ["music", "liked", limit] as const,
  playlists: () => ["music", "playlists"] as const,
  playlist: (id: string) => ["music", "playlist", id] as const,
  source: (id: string) => ["music", "source", id] as const,
  byMbid: (recordings: readonly string[]) => ["music", "by-mbid", [...recordings].sort().join(",")] as const,
};

/** Ce qu'un changement de la BIBLIOTHÈQUE rend faux (pas les sources : un fichier relu garde son URL). */
export const LIBRARY_SCOPES = ["status", "search", "albums", "album", "artists", "artist", "home", "liked", "by-mbid"] as const;

/** Double compatibilité TanStack v4/v5 (la TV résout la v4) : garder la réponse précédente affichée. */
export const KEEP_PREVIOUS = { keepPreviousData: true, placeholderData: (prev: unknown) => prev } as object;
