import { useCallback, useEffect, useMemo, useRef } from "react";
import { Image } from "expo-image";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import {
  getTrickplayTile,
  getTrickplayTileCount,
  pickBestTrickplayWidth,
  type MediaItem,
  type TrickplayInfo,
} from "@tentacle-tv/shared";
import type { LocalTrickplay } from "./offline/useLocalTrickplay";

export interface TrickplayFrame {
  url: string;
  tileIndex: number;
  xInTile: number;
  yInTile: number;
}

export interface UseTrickplayResult {
  available: boolean;
  info: TrickplayInfo | null;
  getFrameAt: (positionMs: number) => TrickplayFrame | null;
  preloadNeighbors: (tileIndex: number) => void;
}

/**
 * Mobile port of the web useTrickplay hook. Reuses the shared math + URL
 * pattern (backend proxy at /api/jellyfin/items/:id/trickplay/:w/:i.jpg) and
 * delegates caching to expo-image's disk/memory cache via Image.prefetch.
 */
export function useTrickplay(
  item: MediaItem | undefined,
  mediaSourceId?: string,
  /** Planches gardées sur l'appareil : elles priment, et rien ne part vers le serveur. */
  local?: LocalTrickplay | null,
  /** Lecture locale : sans planche sur l'appareil, pas d'aperçu — jamais celles du serveur. */
  options?: { localOnly?: boolean },
): UseTrickplayResult {
  const client = useJellyfinClient();
  const localOnly = options?.localOnly === true;
  const selection = useMemo(
    () => (local
      ? { mediaSourceId: local.mediaSourceId, width: local.width, info: local.info }
      : localOnly ? null : pickBestTrickplayWidth(item?.Trickplay, mediaSourceId)),
    [item?.Trickplay, mediaSourceId, local, localOnly],
  );

  const prefetchedRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    prefetchedRef.current = new Set();
  }, [selection?.mediaSourceId, selection?.width, item?.Id]);

  const buildTileUrl = useCallback(
    (tileIndex: number): string | null => {
      if (!selection || !item?.Id) return null;
      if (local) return local.tileUri(tileIndex);
      const base = client.getBaseUrl();
      const token = client.getAccessToken();
      const params: string[] = [`mediaSourceId=${encodeURIComponent(selection.mediaSourceId)}`];
      if (token) params.push(`api_key=${encodeURIComponent(token)}`);
      return `${base}/items/${item.Id}/trickplay/${selection.width}/${tileIndex}.jpg?${params.join("&")}`;
    },
    [selection, item?.Id, client, local],
  );

  const ensureCached = useCallback(
    (tileIndex: number): string | null => {
      const url = buildTileUrl(tileIndex);
      if (!url) return null;
      // Une planche locale se lit sur le disque : rien à préchauffer.
      if (url.startsWith("file://")) return url;
      const seen = prefetchedRef.current;
      if (seen.has(tileIndex)) return url;
      seen.add(tileIndex);
      // Fire-and-forget — expo-image handles disk + memory cache for us.
      Image.prefetch(url).catch(() => {
        // Allow retry next time getFrameAt is called for this tile.
        seen.delete(tileIndex);
      });
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
