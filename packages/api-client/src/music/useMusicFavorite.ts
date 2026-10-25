/**
 * Octave — « Titres likés » et le CŒUR. Le cœur EST le favori Jellyfin du
 * compte (contrat) : le geste part au serveur, l'interface le montre tout de
 * suite partout (recherche, album, artiste, accueil, playlists, titres likés),
 * et revient en arrière si Jellyfin refuse.
 */

import { useInfiniteQuery, useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { MusicTrack } from "@tentacle-tv/shared/music";
import { musicApi } from "./musicApi";
import { likedAfter, withFavorites } from "./musicCachePatch";
import { MUSIC_KEY, musicKeys } from "./musicQueryKeys";
import { useMusicCapability } from "./useMusicLibrary";

export const MUSIC_LIKED_PAGE = 100;

export function useMusicLiked(options: { limit?: number; enabled?: boolean } = {}) {
  const capable = useMusicCapability();
  const limit = options.limit ?? MUSIC_LIKED_PAGE;
  return useInfiniteQuery({
    queryKey: musicKeys.liked(limit),
    queryFn: ({ pageParam, signal }) => musicApi.liked(typeof pageParam === "string" && pageParam ? pageParam : null, limit, signal),
    initialPageParam: "",
    getNextPageParam: (last) => last.cursor ?? undefined,
    enabled: capable && options.enabled !== false,
    staleTime: 30_000,
  });
}

type Snapshot = [readonly unknown[], unknown][];

/** Le cœur posé ou retiré dans TOUT le cache de la musique (sources exceptées : sans cœur). */
export function patchFavorites(qc: QueryClient, changes: ReadonlyMap<string, boolean>, track?: MusicTrack): void {
  qc.setQueriesData({ queryKey: [...MUSIC_KEY] }, (data: unknown) => withFavorites(data, changes));
  if (!track?.jellyfinId || !changes.has(track.jellyfinId)) return;
  const favorite = changes.get(track.jellyfinId)!;
  qc.setQueriesData({ queryKey: ["music", "liked"] }, (data: unknown) =>
    likedAfter(data as Parameters<typeof likedAfter>[0], track, favorite),
  );
}

export function useToggleMusicFavorite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ track, favorite }: { track: MusicTrack; favorite: boolean }) => musicApi.setFavorite(track.jellyfinId!, favorite),
    onMutate: async ({ track, favorite }) => {
      if (!track.jellyfinId) return { snapshot: [] as Snapshot };
      await qc.cancelQueries({ queryKey: [...MUSIC_KEY] });
      const snapshot = qc.getQueriesData({ queryKey: [...MUSIC_KEY] }) as Snapshot;
      patchFavorites(qc, new Map([[track.jellyfinId, favorite]]), track);
      return { snapshot };
    },
    onError: (_error, _vars, context) => {
      for (const [key, data] of context?.snapshot ?? []) qc.setQueryData(key, data);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["music", "liked"] });
    },
  });
}
