import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ExternalActionOutcome, PendingMusicResponse, PlaybackSource, PrefetchIntent } from "@tentacle-tv/shared/music";
import type { MusicProvider } from "./musicProvider";
import {
  addExternalTrackToPlaylist,
  fetchPendingMusic,
  isSourceFresh,
  likeExternalTrack,
  prefetchMusic,
  resolveMusicSources,
} from "./musicRequests";

/**
 * Points 2 à 4 en crochets React : la source d'un titre (gardée en cache tant
 * qu'elle n'expire pas), l'anticipation, les gestes et les entrées EN ATTENTE
 * du compte. Tous muets sans fournisseur (`useMusicProvider` → `null`).
 */

export const musicPendingKey = (pluginId: string | null) => ["music", "pending", pluginId] as const;
const sourceKey = (pluginId: string, externalId: string) => ["music", "source", pluginId, externalId] as const;

/** La fonction qui rend la source d'un titre externe (cache d'abord, puis l'extension). */
export function useMusicResolver(provider: MusicProvider | null): (externalId: string, signal?: AbortSignal) => Promise<PlaybackSource | null> {
  const qc = useQueryClient();
  return useCallback(
    async (externalId, signal) => {
      if (!provider) return null;
      const cached = qc.getQueryData<PlaybackSource>(sourceKey(provider.pluginId, externalId));
      if (cached && isSourceFresh(cached) && cached.complete) return cached;
      const sources = await resolveMusicSources(provider, [externalId], signal);
      const source = sources.get(externalId) ?? null;
      if (source) qc.setQueryData(sourceKey(provider.pluginId, externalId), source);
      return source;
    },
    [provider, qc],
  );
}

/** L'anticipation (`results`, `hover`, `press`, `next`) : silencieuse, jamais bloquante. */
export function useMusicPrefetch(provider: MusicProvider | null): (ids: readonly string[], intent: PrefetchIntent) => void {
  return useCallback(
    (ids, intent) => {
      if (provider) prefetchMusic(provider, ids, intent);
    },
    [provider],
  );
}

export interface MusicGestures {
  like: (externalId: string, liked: boolean) => Promise<ExternalActionOutcome>;
  playlistAdd: (externalId: string, playlistId: string, position: number) => Promise<ExternalActionOutcome>;
  /** L'extension sait-elle aimer / ajouter à une playlist ? Sinon, pas de bouton. */
  canLike: boolean;
  canPlaylistAdd: boolean;
}

const UNAVAILABLE: ExternalActionOutcome = { ok: false, reason: "unavailable", message: null };

/** Point 3 — les gestes : l'état `pending` est rendu tout de suite, la liste d'attente se relit. */
export function useMusicGestures(provider: MusicProvider | null): MusicGestures {
  const qc = useQueryClient();
  const settle = useCallback(() => {
    void qc.invalidateQueries({ queryKey: musicPendingKey(provider?.pluginId ?? null) });
  }, [qc, provider]);
  const like = useMutation({
    mutationFn: ({ externalId, liked }: { externalId: string; liked: boolean }) =>
      provider ? likeExternalTrack(provider, externalId, liked) : Promise.resolve(UNAVAILABLE),
    onSettled: settle,
  });
  const add = useMutation({
    mutationFn: ({ externalId, playlistId, position }: { externalId: string; playlistId: string; position: number }) =>
      provider ? addExternalTrackToPlaylist(provider, externalId, playlistId, position) : Promise.resolve(UNAVAILABLE),
    onSettled: settle,
  });
  const { mutateAsync: likeAsync } = like;
  const { mutateAsync: addAsync } = add;
  return {
    like: useCallback((externalId, liked) => likeAsync({ externalId, liked }), [likeAsync]),
    playlistAdd: useCallback((externalId, playlistId, position) => addAsync({ externalId, playlistId, position }), [addAsync]),
    canLike: !!provider?.music.like,
    canPlaylistAdd: !!provider?.music.playlistAdd,
  };
}

/** Point 4 — les entrées en attente du COMPTE (« Titres likés », playlists), relues sur `music:pending` / `music:resolved`. */
export function useMusicPending(provider: MusicProvider | null): { data: PendingMusicResponse; isPending: boolean } {
  const enabled = !!provider?.music.pending;
  const query = useQuery({
    queryKey: musicPendingKey(provider?.pluginId ?? null),
    queryFn: ({ signal }) => (provider ? fetchPendingMusic(provider, signal) : Promise.resolve({ items: [] })),
    enabled,
    staleTime: 30_000,
    retry: false,
  });
  return { data: query.data ?? { items: [] }, isPending: enabled && query.isPending };
}
