import { useCallback, useEffect, useMemo, useRef } from "react";
import { buildTrickplayTileUrl, useJellyfinClient } from "@tentacle-tv/api-client";
import {
  getTrickplayTile,
  getTrickplayTileCount,
  pickBestTrickplayWidth,
  type MediaItem,
  type TrickplayInfo,
} from "@tentacle-tv/shared";
import { useLocalTrickplay } from "./useLocalTrickplay";

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
  /** Lecture locale : trickplay servi depuis le disque (serveur loopback). */
  localItemId?: string,
): UseTrickplayResult {
  const client = useJellyfinClient();
  const local = useLocalTrickplay(localItemId);
  // Source du manifeste : local d'abord (lecture locale), sinon le DTO Jellyfin.
  const trickplayManifest = local?.manifest ?? item?.Trickplay;
  const selection = useMemo(
    () => pickBestTrickplayWidth(trickplayManifest, mediaSourceId),
    [trickplayManifest, mediaSourceId],
  );

  const cacheRef = useRef<Map<number, HTMLImageElement>>(new Map());

  // Reset cache when the underlying selection changes (different item or width).
  // The previous Images become eligible for GC once consumers drop their refs.
  useEffect(() => {
    cacheRef.current = new Map();
    return () => {
      cacheRef.current.clear();
    };
  }, [selection?.mediaSourceId, selection?.width, item?.Id, localItemId]);

  const buildTileUrl = useCallback(
    (tileIndex: number): string | null => {
      if (!selection) return null;
      // Lecture locale : tuiles servies par le serveur loopback.
      if (local) return local.buildTileUrl(tileIndex);
      if (!item?.Id) return null;
      // URL commune à toutes les plateformes (proxy Tentacle, cache immuable) —
      // le pourquoi du `api_key` vit dans `buildTrickplayTileUrl`.
      return buildTrickplayTileUrl(
        client.getBaseUrl(),
        client.getAccessToken(),
        item.Id,
        selection.mediaSourceId,
        selection.width,
        tileIndex,
      );
    },
    [selection, item?.Id, client, local],
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
      if (import.meta.env.DEV && cache.size > DEV_CACHE_SOFT_CAP) {
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
