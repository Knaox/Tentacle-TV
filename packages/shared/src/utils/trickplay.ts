import type { TrickplayInfo, TrickplayManifest } from "../types/media";

export interface TrickplayTileCoords {
  /** Index of the tile mosaic JPEG to fetch (0-based). */
  tileIndex: number;
  /** X offset in pixels inside the tile mosaic. */
  xInTile: number;
  /** Y offset in pixels inside the tile mosaic. */
  yInTile: number;
}

/**
 * Translate a playback position (ms) into the tile mosaic + (x, y) offset
 * to display from it. Pure function — no side effects.
 */
export function getTrickplayTile(
  positionMs: number,
  info: TrickplayInfo,
): TrickplayTileCoords {
  const tilesPerImage = info.TileWidth * info.TileHeight;
  const safePos = Math.max(0, positionMs);
  const frameIndex = Math.floor(safePos / info.Interval);
  const tileIndex = Math.floor(frameIndex / tilesPerImage);
  const localIdx = frameIndex % tilesPerImage;
  const xInTile = (localIdx % info.TileWidth) * info.Width;
  const yInTile = Math.floor(localIdx / info.TileWidth) * info.Height;
  return { tileIndex, xInTile, yInTile };
}

/** Total number of tile mosaics for a given width entry. */
export function getTrickplayTileCount(info: TrickplayInfo): number {
  const tilesPerImage = info.TileWidth * info.TileHeight;
  return Math.ceil(info.ThumbnailCount / tilesPerImage);
}

export interface TrickplaySelection {
  mediaSourceId: string;
  width: number;
  info: TrickplayInfo;
}

/**
 * Pick the best (mediaSourceId, width) entry from a manifest.
 * Strategy: prefer the requested mediaSourceId (or the first one available),
 * then pick the width closest to `preferred` (default 320). Returns null
 * when the manifest is missing/empty.
 */
export function pickBestTrickplayWidth(
  manifest: TrickplayManifest | undefined | null,
  mediaSourceId?: string,
  preferred = 320,
): TrickplaySelection | null {
  if (!manifest) return null;
  const sourceIds = Object.keys(manifest);
  if (sourceIds.length === 0) return null;

  const sourceId = mediaSourceId && manifest[mediaSourceId] ? mediaSourceId : sourceIds[0];
  const widthMap = manifest[sourceId];
  if (!widthMap) return null;

  const widths = Object.keys(widthMap)
    .map((w) => Number(w))
    .filter((w) => Number.isFinite(w) && w > 0);
  if (widths.length === 0) return null;

  const best = widths.reduce((acc, w) =>
    Math.abs(w - preferred) < Math.abs(acc - preferred) ? w : acc,
  );
  const info = widthMap[String(best)];
  if (!info) return null;

  return { mediaSourceId: sourceId, width: best, info };
}
