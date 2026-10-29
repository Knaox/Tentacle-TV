/**
 * Octave mobile — les données d'une liste de titres, EXACTEMENT celles du bureau (`LikedView`, `PlaylistView`) :
 * les titres de Jellyfin et, à leur place, les attentes de l'extension (`mergeLiked`, `mergePlaylist`) ; une
 * attente que la bibliothèque a déjà se montre comme elle (`useLibraryFirstRows`) ; les statistiques d'entrée
 * pour trier (`makeStatsOf`) ; l'ordre du COMPTE (`useListOrder` : tri, recherche, filtre, glisser).
 */

import { useCallback, useMemo } from "react";
import { useLibraryFirstRows, useListOrder, useMusicPending, useMusicPlaylist, usePlaylistSharingRules, useReorderMusicPlaylist, useWholeLiked } from "@tentacle-tv/api-client";
import { parseListKey, type MusicListStats } from "@tentacle-tv/shared/music";
import { makeStatsOf, mergeLiked, mergePlaylist } from "@tentacle-tv/shared/octave";
import { useOctavePagesProvider } from "../../pages";

export function usePendingMusic() {
  return useMusicPending(useOctavePagesProvider()).data.items;
}

export function useLikedData() {
  const { liked, sortable, stats, complete } = useWholeLiked();
  const pending = usePendingMusic();
  const items = useMemo(() => (liked.data?.pages ?? []).flatMap((p) => p.items), [liked.data]);
  const natural = useLibraryFirstRows(useMemo(() => mergeLiked(items, pending), [items, pending]));
  const statsOf = useMemo(() => makeStatsOf({ byJellyfin: stats, pending }), [pending, stats]);
  const order = useListOrder("liked", natural, statsOf, { complete });
  const waiting = natural.filter((r) => r.pending).length;
  const total = (liked.data?.pages[0]?.total ?? natural.length - waiting) + waiting;
  return { liked, sortable, natural, order, total, loading: liked.isPending || !order.ready };
}

export function usePlaylistData(id: string) {
  const playlist = useMusicPlaylist(id);
  const pending = usePendingMusic();
  const entries = playlist.data?.entries;
  const natural = useLibraryFirstRows(useMemo(() => mergePlaylist(entries ?? [], pending, id), [entries, id, pending]));
  const statsOf = useMemo(() => {
    const byEntry = new Map<string, MusicListStats>((entries ?? []).flatMap((e) => (e.stats ? [[e.entryId, e.stats] as const] : [])));
    return makeStatsOf({ byEntry, pending, natural });
  }, [entries, natural, pending]);
  const editable = playlist.data?.editable === true;
  // Partagée (`musicPlaylistMembers.ts`) : chacun son ordre, jamais celui de Jellyfin ; les ajouts des autres au bout.
  const rules = usePlaylistSharingRules(playlist.data);
  const reorderPlaylist = useReorderMusicPlaylist();
  const onJellyfinOrder = useCallback((entryIds: string[]) => reorderPlaylist(id, entryIds), [id, reorderPlaylist]);
  const order = useListOrder(parseListKey(`playlist:${id}`), natural, statsOf, {
    complete: true,
    onJellyfinOrder: editable && !rules.isShared ? onJellyfinOrder : undefined,
    newcomers: rules.isShared ? "end" : undefined,
  });
  return { playlist, natural, order, editable, rules, loading: playlist.isPending || !order.ready };
}
