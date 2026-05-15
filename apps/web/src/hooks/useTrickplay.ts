import { useCallback, useEffect, useMemo, useRef } from "react";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import {
  getTrickplayTile,
  getTrickplayTileCount,
  pickBestTrickplayWidth,
  type MediaItem,
  type TrickplayInfo,
} from "@tentacle-tv/shared";

export interface TrickplayFrame {
  url: string;
  tileIndex: number;
  xInTile: number;
  yInTile: number;
}

export interface UseTrickplayResult {
  available: boolean;
  info: TrickplayInfo | null;
  /** Resolve the tile URL + (x, y) offset for a playback position. */
  getFrameAt: (positionMs: number) => TrickplayFrame | null;
  /** Pre-fetch the two neighboring tile mosaics (no-op if already cached). */
  preloadNeighbors: (tileIndex: number) => void;
}

/** Soft cap on in-memory cached tiles per session — exceeding it likely means a regression. */
const DEV_CACHE_SOFT_CAP = 20;

/**
 * Lazy trickplay tile loader. No fetch happens until the consumer calls
 * getFrameAt() / preloadNeighbors() (typically wired to seekbar hover).
 * Tiles loaded once are kept in a per-instance Map so repeated hovers on
 * the same position never re-instantiate Image().
 */
export function useTrickplay(
  item: MediaItem | undefined,
  mediaSourceId?: string,
): UseTrickplayResult {
  const client = useJellyfinClient();
  const selection = useMemo(
    () => pickBestTrickplayWidth(item?.Trickplay, mediaSourceId),
    [item?.Trickplay, mediaSourceId],
  );

  const cacheRef = useRef<Map<number, HTMLImageElement>>(new Map());

  // Reset cache when the underlying selection changes (different item or width).
  // The previous Images become eligible for GC once consumers drop their refs.
  useEffect(() => {
    cacheRef.current = new Map();
    return () => {
      cacheRef.current.clear();
    };
  }, [selection?.mediaSourceId, selection?.width, item?.Id]);

  const buildTileUrl = useCallback(
    (tileIndex: number): string | null => {
      if (!selection || !item?.Id) return null;
      // Absolute URL: hits the same backend as the rest of the Jellyfin client.
      // Token via query param (api_key) because background-image / new Image()
      // cannot send custom headers nor cross-origin cookies.
      const base = client.getBaseUrl();
      const token = client.getAccessToken();
      const params = new URLSearchParams({ mediaSourceId: selection.mediaSourceId });
      if (token) params.set("api_key", token);
      return `${base}/items/${item.Id}/trickplay/${selection.width}/${tileIndex}.jpg?${params.toString()}`;
    },
    [selection, item?.Id, client],
  );

  const ensureCached = useCallback(
    (tileIndex: number): string | null => {
      const url = buildTileUrl(tileIndex);
      if (!url) return null;
      const cache = cacheRef.current;
      if (cache.has(tileIndex)) return url;
      const img = new Image();
      img.src = url;
      cache.set(tileIndex, img);
      if (process.env.NODE_ENV === "development" && cache.size > DEV_CACHE_SOFT_CAP) {
        console.warn(
          `[useTrickplay] in-memory cache size ${cache.size} exceeds soft cap ${DEV_CACHE_SOFT_CAP} — likely a regression (bulk preload?)`,
        );
      }
      return url;
    },
    [buildTileUrl],
  );

  const getFrameAt = useCallback(
    (positionMs: number): TrickplayFrame | null => {
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
