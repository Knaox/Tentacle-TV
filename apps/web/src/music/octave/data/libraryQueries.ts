/**
 * Octave — les requêtes de la bibliothèque musique (TanStack Query), sur
 * l'adaptateur `libraryApi.ts`. Clés sous `octave` + compte : un changement de
 * profil ne mélange rien. À rebrancher sur les crochets de l'api-client (agent 3).
 */

import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useUserId } from "@tentacle-tv/api-client";
import type { MusicPage } from "@tentacle-tv/shared/music";
import { libraryApi } from "./libraryApi";

export const OCTAVE_KEY = "octave";

export const octaveKeys = {
  all: (user: string | null) => [OCTAVE_KEY, user] as const,
  home: (user: string | null) => [OCTAVE_KEY, user, "home"] as const,
  search: (user: string | null, q: string) => [OCTAVE_KEY, user, "search", q] as const,
  albums: (user: string | null, sort: string) => [OCTAVE_KEY, user, "albums", sort] as const,
  album: (user: string | null, id: string) => [OCTAVE_KEY, user, "album", id] as const,
  artists: (user: string | null) => [OCTAVE_KEY, user, "artists"] as const,
  artist: (user: string | null, id: string) => [OCTAVE_KEY, user, "artist", id] as const,
  liked: (user: string | null) => [OCTAVE_KEY, user, "liked"] as const,
  playlists: (user: string | null) => [OCTAVE_KEY, user, "playlists"] as const,
  playlist: (user: string | null, id: string) => [OCTAVE_KEY, user, "playlist", id] as const,
  pending: (user: string | null) => [OCTAVE_KEY, user, "pending"] as const,
};

/** Les pages d'une liste mises bout à bout. */
export function flattenPages<T>(pages: readonly MusicPage<T>[] | undefined): T[] {
  return pages ? pages.flatMap((p) => p.items) : [];
}

export function useMusicHome() {
  const user = useUserId();
  return useQuery({ queryKey: octaveKeys.home(user), queryFn: libraryApi.home, enabled: !!user, staleTime: 30_000 });
}

/** La recherche locale (< 100 ms côté serveur) : la réponse précédente reste affichée pendant la frappe. */
export function useMusicSearch(q: string) {
  const user = useUserId();
  const query = q.trim();
  return useQuery({
    queryKey: octaveKeys.search(user, query),
    queryFn: ({ signal }) => libraryApi.search(query, 20, signal),
    enabled: !!user && query.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

export function useMusicAlbums(sort: string) {
  const user = useUserId();
  return useInfiniteQuery({
    queryKey: octaveKeys.albums(user, sort),
    queryFn: ({ pageParam }) => libraryApi.albums(pageParam, sort),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.cursor,
    enabled: !!user,
    staleTime: 60_000,
  });
}

export function useMusicArtists() {
  const user = useUserId();
  return useInfiniteQuery({
    queryKey: octaveKeys.artists(user),
    queryFn: ({ pageParam }) => libraryApi.artists(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.cursor,
    enabled: !!user,
    staleTime: 60_000,
  });
}

export function useMusicAlbum(id: string | null) {
  const user = useUserId();
  return useQuery({ queryKey: octaveKeys.album(user, id ?? ""), queryFn: () => libraryApi.album(id ?? ""), enabled: !!user && !!id, staleTime: 60_000 });
}

export function useMusicArtist(id: string | null) {
  const user = useUserId();
  return useQuery({ queryKey: octaveKeys.artist(user, id ?? ""), queryFn: () => libraryApi.artist(id ?? ""), enabled: !!user && !!id, staleTime: 60_000 });
}

export function useMusicLiked() {
  const user = useUserId();
  return useInfiniteQuery({
    queryKey: octaveKeys.liked(user),
    queryFn: ({ pageParam }) => libraryApi.liked(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.cursor,
    enabled: !!user,
    staleTime: 30_000,
  });
}

export function useMusicPlaylists() {
  const user = useUserId();
  return useQuery({ queryKey: octaveKeys.playlists(user), queryFn: libraryApi.playlists, enabled: !!user, staleTime: 30_000 });
}

export function useMusicPlaylist(id: string | null) {
  const user = useUserId();
  return useQuery({ queryKey: octaveKeys.playlist(user, id ?? ""), queryFn: () => libraryApi.playlist(id ?? ""), enabled: !!user && !!id, staleTime: 15_000 });
}
