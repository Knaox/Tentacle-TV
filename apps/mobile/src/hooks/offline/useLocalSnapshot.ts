import { useQuery } from "@tanstack/react-query";
import { LOCAL_QUERY } from "@tentacle-tv/offline-core/react";
import { localExists, metaUri, readLocalJson } from "@/offline/engineApi";

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
