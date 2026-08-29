/**
 * Les segments de lecture, LOCAL D'ABORD : en lecture locale ils viennent du
 * snapshot disque (zéro réseau, fonctionne hors ligne) ; en streaming, du
 * résolveur unique du backend (`usePlaybackSegments`).
 */

import { usePlaybackSegments } from "@tentacle-tv/api-client";
import type { MediaItem, PlaybackSegmentsResponse } from "@tentacle-tv/shared";
import { useLocalSegments } from "./useLocalSegments";

export function useSegmentsLocalFirst(
  itemId: string | undefined,
  item: MediaItem | undefined,
  isLocalPlayback: boolean,
): PlaybackSegmentsResponse {
  const server = usePlaybackSegments(itemId, { enabled: !isLocalPlayback });
  const local = useLocalSegments(itemId, item, isLocalPlayback);
  return isLocalPlayback ? local : server;
}
