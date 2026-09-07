import { useMemo } from "react";
import { resolveLocalSegmentsPayload } from "@tentacle-tv/offline-core";
import type { MediaItem, PlaybackSegmentsResponse } from "@tentacle-tv/shared";
import { useLocalSnapshotJson } from "./useLocalSnapshot";

/**
 * Les segments (intro, résumé, générique, scène post-générique) depuis le
 * snapshot local — le contrat résolu tel quel, ou, pour un snapshot ancien,
 * la même résolution que le serveur sur ce que le disque sait. Jamais le
 * réseau.
 */
export function useLocalSegments(itemId: string, item: MediaItem | undefined): PlaybackSegmentsResponse {
  const { data } = useLocalSnapshotJson<unknown>(itemId, "segments.json");
  return useMemo(() => resolveLocalSegmentsPayload(data ?? null, itemId, item), [data, itemId, item]);
}
