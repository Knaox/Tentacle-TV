import { useCallback, useEffect, useMemo, useRef } from "react";
import { Image } from "react-native";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import {
  getTrickplayTile,
  getTrickplayTileCount,
  pickBestTrickplayWidth,
  type MediaItem,
  type TrickplayInfo,
} from "@tentacle-tv/shared";

export interface TVTrickplayFrame {
  url: string;
  tileIndex: number;
  xInTile: number;
  yInTile: number;
}

export interface UseTVTrickplayResult {
  available: boolean;
  info: TrickplayInfo | null;
  getFrameAt: (positionMs: number) => TVTrickplayFrame | null;
  preloadNeighbors: (tileIndex: number) => void;
}

/**
 * Port TV du useTrickplay mobile : mêmes maths partagées + même proxy backend
 * (/api/jellyfin/items/:id/trickplay/:w/:i.jpg, cache HTTP 1 an). Le cache
 * image est délégué à RN Image (Image.prefetch).
 */
export function useTVTrickplay(
  item: MediaItem | undefined | null,
  mediaSourceId?: string,
): UseTVTrickplayResult {
  const client = useJellyfinClient();
  const selection = useMemo(
    () => pickBestTrickplayWidth(item?.Trickplay, mediaSourceId),
    [item?.Trickplay, mediaSourceId],
  );

  const prefetchedRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    prefetchedRef.current = new Set();
  }, [selection?.mediaSourceId, selection?.width, item?.Id]);

  const buildTileUrl = useCallback(
    (tileIndex: number): string | null => {
      if (!selection || !item?.Id) return null;
      const base = client.getBaseUrl();
      const token = client.getAccessToken();
      const params: string[] = [`mediaSourceId=${encodeURIComponent(selection.mediaSourceId)}`];
      if (token) params.push(`api_key=${encodeURIComponent(token)}`);
      return `${base}/items/${item.Id}/trickplay/${selection.width}/${tileIndex}.jpg?${params.join("&")}`;
    },
    [selection, item?.Id, client],
  );

  const ensureCached = useCallback(
    (tileIndex: number): string | null => {
      const url = buildTileUrl(tileIndex);
      if (!url) return null;
      const seen = prefetchedRef.current;
      if (seen.has(tileIndex)) return url;
      seen.add(tileIndex);
      Image.prefetch(url).catch(() => {
        // Autorise une nouvelle tentative au prochain getFrameAt sur cette tuile.
        seen.delete(tileIndex);
      });
      return url;
    },
    [buildTileUrl],
  );

  const getFrameAt = useCallback(
    (positionMs: number): TVTrickplayFrame | null => {
      if (!selection) return null;
      const coords = getTrickplayTile(positionMs, selection.info);
      const url = ensureCached(coords.tileIndex);
      if (!url) return null;
      return { url, ...coords };
    },
    [selection, ensureCached],
  );

  const preloadNeighbors = useCallback(
    (tileIndex: number): void => {
      if (!selection) return;
      const total = getTrickplayTileCount(selection.info);
      if (tileIndex - 1 >= 0) ensureCached(tileIndex - 1);
      if (tileIndex + 1 < total) ensureCached(tileIndex + 1);
    },
    [selection, ensureCached],
  );

  return {
    available: selection !== null,
    info: selection?.info ?? null,
    getFrameAt,
    preloadNeighbors,
  };
}
