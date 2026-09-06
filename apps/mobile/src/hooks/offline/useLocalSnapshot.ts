import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { MediaItem } from "@tentacle-tv/shared";
import { LOCAL_QUERY } from "@tentacle-tv/offline-core/react";
import { localExists, metaUri, readLocalJson, type OfflineLocalSource } from "@/offline/engineApi";

export const LOCAL_SNAPSHOT_QUERY_KEY = "local-snapshot";

/** Un JSON du snapshot (`item.json`, `series.json`, `segments.json`…), ou `null`. */
export function useLocalSnapshotJson<T>(itemId: string | undefined, fileName: string) {
  return useQuery({
    queryKey: [LOCAL_SNAPSHOT_QUERY_KEY, itemId, fileName],
    queryFn: () => readLocalJson<T>(metaUri(itemId as string, fileName)),
    enabled: itemId !== undefined,
    staleTime: 60_000,
    ...LOCAL_QUERY,
  });
}

/**
 * L'URI `file://` d'un visuel du snapshot s'il existe (`primary.jpg`,
 * `backdrop.jpg`, `logo.png`, `series-primary.jpg`), sinon `null`.
 */
export function useLocalArtworkUri(itemId: string | undefined, fileName: string): string | null {
  const { data } = useQuery({
    queryKey: [LOCAL_SNAPSHOT_QUERY_KEY, "artwork", itemId, fileName],
    queryFn: () => {
      const uri = metaUri(itemId as string, fileName);
      return localExists(uri) ? uri : null;
    },
    enabled: itemId !== undefined,
    staleTime: 60_000,
    ...LOCAL_QUERY,
  });
  return data ?? null;
}

/**
 * L'item du snapshot local (`item.json`, sans `UserData` — figée au moment de
 * la mise de côté, elle mentirait), avec la progression LOCALE synthétisée ;
 * à défaut, un item minimal bâti sur la source locale, pour que le lecteur
 * reste présentable sans aucune donnée serveur — jamais de S00E00.
 */
export function useLocalSnapshotItem(itemId: string, source: OfflineLocalSource): MediaItem {
  const { data: snapshot } = useLocalSnapshotJson<MediaItem>(itemId, "item.json");
  return useMemo(() => {
    const userData = {
      PlaybackPositionTicks: source.played ? 0 : source.positionTicks,
      Played: source.played,
      PlayCount: source.played ? 1 : 0,
      IsFavorite: false,
    };
    if (snapshot && snapshot.Id === itemId) return { ...snapshot, UserData: userData };
    const episode = source.seriesName !== null || source.indexNumber !== null;
    return {
      Id: itemId,
      Name: source.title ?? "",
      Type: episode ? "Episode" : "Movie",
      SeriesName: source.seriesName ?? undefined,
      IndexNumber: source.indexNumber ?? undefined,
      ParentIndexNumber: source.parentIndexNumber ?? undefined,
      RunTimeTicks: source.runtimeTicks ?? undefined,
      UserData: userData,
    };
  }, [snapshot, itemId, source]);
}
