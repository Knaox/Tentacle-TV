/**
 * Octave — la bibliothèque musique Jellyfin, vue par le compte. Chaque
 * requête attend la capacité `music.library` du serveur (sans elle : aucune
 * requête, aucune trace), et la vue « status » dit si le compte voit une
 * bibliothèque musique — `useMusicAvailable` est la seule porte du mode Octave
 * côté bibliothèque.
 *
 * Double compatibilité TanStack v4/v5 (la TV résout la v4) : pas d'import du
 * helper `keepPreviousData`, pages infinies avec `initialPageParam` (v5) ET un
 * `pageParam` absent toléré (v4).
 */

import { useInfiniteQuery, useQuery, type QueryClient } from "@tanstack/react-query";
import type { MusicSourceResponse } from "@tentacle-tv/shared/music";
import { useServerCapability } from "../hooks/useServerCapabilities";
import { musicApi, type MusicAlbumSort } from "./musicApi";
import { KEEP_PREVIOUS, musicKeys } from "./musicQueryKeys";

const STALE_MS = 60_000;

export function useMusicCapability(): boolean {
  return useServerCapability("music.library");
}

export function useMusicStatus() {
  const capable = useMusicCapability();
  return useQuery({ queryKey: musicKeys.status(), queryFn: ({ signal }) => musicApi.status(signal), enabled: capable, staleTime: STALE_MS });
}

/** Vrai : le serveur sait servir la musique ET ce compte voit une bibliothèque musique. */
export function useMusicAvailable(): boolean {
  const status = useMusicStatus();
  return status.data?.available === true;
}

function cursorOf(pageParam: unknown): string | null {
  return typeof pageParam === "string" && pageParam !== "" ? pageParam : null;
}

export function useMusicAlbums(options: { sort?: MusicAlbumSort; limit?: number; enabled?: boolean } = {}) {
  const capable = useMusicCapability();
  const sort = options.sort ?? "name";
  const limit = options.limit ?? 60;
  return useInfiniteQuery({
    queryKey: musicKeys.albums(sort, limit),
    queryFn: ({ pageParam, signal }) => musicApi.albums(cursorOf(pageParam), limit, sort, signal),
    initialPageParam: "",
    getNextPageParam: (last) => last.cursor ?? undefined,
    enabled: capable && options.enabled !== false,
    staleTime: STALE_MS,
    ...KEEP_PREVIOUS,
  });
}

export function useMusicAlbum(id: string | null | undefined) {
  const capable = useMusicCapability();
  return useQuery({
    queryKey: musicKeys.album(id ?? ""),
    queryFn: ({ signal }) => musicApi.album(id!, signal),
    enabled: capable && !!id,
    staleTime: STALE_MS,
  });
}

export function useMusicArtists(options: { limit?: number; enabled?: boolean } = {}) {
  const capable = useMusicCapability();
  const limit = options.limit ?? 60;
  return useInfiniteQuery({
    queryKey: musicKeys.artists(limit),
    queryFn: ({ pageParam, signal }) => musicApi.artists(cursorOf(pageParam), limit, signal),
    initialPageParam: "",
    getNextPageParam: (last) => last.cursor ?? undefined,
    enabled: capable && options.enabled !== false,
    staleTime: STALE_MS,
  });
}

export function useMusicArtist(id: string | null | undefined) {
  const capable = useMusicCapability();
  return useQuery({
    queryKey: musicKeys.artist(id ?? ""),
    queryFn: ({ signal }) => musicApi.artist(id!, signal),
    enabled: capable && !!id,
    staleTime: STALE_MS,
  });
}

export function useMusicHome(options: { enabled?: boolean } = {}) {
  const capable = useMusicCapability();
  return useQuery({
    queryKey: musicKeys.home(),
    queryFn: ({ signal }) => musicApi.home(signal),
    enabled: capable && options.enabled !== false,
    staleTime: 30_000,
    ...KEEP_PREVIOUS,
  });
}

/** Des titres de la bibliothèque par MBID d'enregistrement (fusion avec les résultats d'une extension). */
export function useMusicByMbid(recordings: readonly string[]) {
  const capable = useMusicCapability();
  return useQuery({
    queryKey: musicKeys.byMbid(recordings),
    queryFn: ({ signal }) => musicApi.byMbid([...recordings], signal),
    enabled: capable && recordings.length > 0,
    staleTime: STALE_MS,
    ...KEEP_PREVIOUS,
  });
}

/** La source d'un titre ne change pas tant que le fichier ne change pas : gardée longtemps. */
const SOURCE_STALE_MS = 10 * 60_000;

export function useMusicSource(id: string | null | undefined) {
  const capable = useMusicCapability();
  return useQuery({
    queryKey: musicKeys.source(id ?? ""),
    queryFn: ({ signal }) => musicApi.source(id!, signal),
    enabled: capable && !!id,
    staleTime: SOURCE_STALE_MS,
  });
}

/**
 * La source d'un titre, servie du cache si elle y est (le lecteur la demande
 * au clic, à l'anticipation du suivant) — jamais deux requêtes pour le même.
 */
export function fetchMusicSource(qc: QueryClient, id: string): Promise<MusicSourceResponse> {
  return qc.fetchQuery({ queryKey: musicKeys.source(id), queryFn: ({ signal }) => musicApi.source(id, signal), staleTime: SOURCE_STALE_MS });
}
