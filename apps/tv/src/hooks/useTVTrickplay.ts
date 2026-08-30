import { useCallback, useEffect, useMemo, useRef } from "react";
import { Image } from "react-native";
import { buildTrickplayTileUrl, useJellyfinClient } from "@tentacle-tv/api-client";
import {
  getTrickplayTile,
  getTrickplayTileCount,
  pickBestTrickplayWidth,
  type MediaItem,
  type TrickplayInfo,
  type TrickplayManifest,
  type TrickplaySelection,
} from "@tentacle-tv/shared";

export interface TVTrickplayFrame {
  url: string;
  tileIndex: number;
  xInTile: number;
  yInTile: number;
}

/** API d'une sélection trickplay (une largeur donnée). */
export interface TVTrickplayApi {
  info: TrickplayInfo | null;
  getFrameAt: (positionMs: number) => TVTrickplayFrame | null;
  preloadNeighbors: (tileIndex: number, radius?: number) => void;
}

export interface UseTVTrickplayResult extends TVTrickplayApi {
  available: boolean;
  /** Variante HAUTE RÉSOLUTION pour la prévisualisation plein écran : plus
   *  grande largeur du manifeste dont la mosaïque tient sous la limite de
   *  texture GPU (Apple TV HD = 4096 px). null si identique à la sélection
   *  standard (un seul jeu de tuiles serveur, cas fréquent en 320 px). */
  hiRes: TVTrickplayApi | null;
}

/** Limite de texture GPU (px) : une mosaïque JPEG au-delà ne rend pas sur
 *  Apple TV HD (A8). Les tuiles Jellyfin 320×180 en 10×10 = 3200×1800 → OK. */
const MAX_MOSAIC_PX = 4096;

/** Plus grande largeur dont la mosaïque tient sous MAX_MOSAIC_PX. */
function pickLargestSafe(
  manifest: TrickplayManifest | undefined | null,
  mediaSourceId?: string,
): TrickplaySelection | null {
  if (!manifest) return null;
  const sourceIds = Object.keys(manifest);
  if (sourceIds.length === 0) return null;
  const sourceId = mediaSourceId && manifest[mediaSourceId] ? mediaSourceId : sourceIds[0];
  const widthMap = manifest[sourceId];
  if (!widthMap) return null;
  const widths = Object.keys(widthMap)
    .map((w) => Number(w))
    .filter((w) => Number.isFinite(w) && w > 0)
    .sort((a, b) => b - a);
  for (const w of widths) {
    const info = widthMap[String(w)];
    if (!info) continue;
    if (info.Width * info.TileWidth <= MAX_MOSAIC_PX && info.Height * info.TileHeight <= MAX_MOSAIC_PX) {
      return { mediaSourceId: sourceId, width: w, info };
    }
  }
  return null;
}

/** Construit l'API (URL de tuile + prefetch RN Image + coordonnées) d'UNE
 *  sélection. Les callbacks tolèrent selection=null (retour null/no-op). */
function useTrickplayApi(selection: TrickplaySelection | null, itemId: string | undefined): TVTrickplayApi {
  const client = useJellyfinClient();
  const prefetchedRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    prefetchedRef.current = new Set();
  }, [selection?.mediaSourceId, selection?.width, itemId]);

  const buildTileUrl = useCallback(
    (tileIndex: number): string | null => {
      if (!selection || !itemId) return null;
      // URL commune à toutes les plateformes (proxy Tentacle, cache immuable) —
      // le pourquoi du `api_key` vit dans `buildTrickplayTileUrl`.
      return buildTrickplayTileUrl(
        client.getBaseUrl(),
        client.getAccessToken(),
        itemId,
        selection.mediaSourceId,
        selection.width,
        tileIndex,
      );
    },
    [selection, itemId, client],
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
    (tileIndex: number, radius = 1): void => {
      if (!selection) return;
      const total = getTrickplayTileCount(selection.info);
      for (let d = 1; d <= radius; d++) {
        if (tileIndex - d >= 0) ensureCached(tileIndex - d);
        if (tileIndex + d < total) ensureCached(tileIndex + d);
      }
    },
    [selection, ensureCached],
  );

  return useMemo(
    () => ({ info: selection?.info ?? null, getFrameAt, preloadNeighbors }),
    [selection, getFrameAt, preloadNeighbors],
  );
}

/**
 * Port TV du useTrickplay mobile : mêmes maths partagées + même proxy backend
 * (/api/jellyfin/items/:id/trickplay/:w/:i.jpg, cache HTTP 1 an). Le cache
 * image est délégué à RN Image (Image.prefetch). Sélection standard (~320 px,
 * vignette de reload) + variante hiRes pour le scrub plein écran.
 */
export function useTVTrickplay(
  item: MediaItem | undefined | null,
  mediaSourceId?: string,
): UseTVTrickplayResult {
  const stdSel = useMemo(
    () => pickBestTrickplayWidth(item?.Trickplay, mediaSourceId),
    [item?.Trickplay, mediaSourceId],
  );
  const hiSel = useMemo(() => {
    const hi = pickLargestSafe(item?.Trickplay, mediaSourceId);
    return hi && stdSel && hi.width !== stdSel.width ? hi : null;
  }, [item?.Trickplay, mediaSourceId, stdSel]);

  const std = useTrickplayApi(stdSel, item?.Id);
  const hi = useTrickplayApi(hiSel, item?.Id);

  return useMemo(
    () => ({ ...std, available: stdSel !== null, hiRes: hiSel ? hi : null }),
    [std, stdSel, hi, hiSel],
  );
}
