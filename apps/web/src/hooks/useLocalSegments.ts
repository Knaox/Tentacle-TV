/**
 * Les segments RÉSOLUS depuis le snapshot disque (`meta/<id>/segments.json`,
 * loopback) — zéro réseau en lecture locale. La relecture pure (contrat v1,
 * ancien format brut, fichier absent) vit dans `lib/localSegments.ts`.
 */

import { useEffect, useMemo, useState } from "react";
import { emptyPlaybackSegments, type MediaItem, type PlaybackSegmentsResponse } from "@tentacle-tv/shared";
import { localResourceUrl, useDownloadsRootReady } from "../downloads/localFiles";
import { resolveLocalSegmentsPayload } from "../lib/localSegments";

const EMPTY: PlaybackSegmentsResponse = emptyPlaybackSegments("", "");

export function useLocalSegments(
  itemId: string | undefined,
  item: MediaItem | undefined,
  isLocalPlayback: boolean,
): PlaybackSegmentsResponse {
  const rootReady = useDownloadsRootReady();
  const [raw, setBrut] = useState<unknown>(null);

  useEffect(() => {
    setBrut(null);
    if (!itemId || !isLocalPlayback || !rootReady) return;
    const url = localResourceUrl(`meta/${itemId}/segments.json`);
    if (!url) return;
    let cancelled = false;
    void fetch(url)
      .then((res) => (res.ok ? res.json() : null))
      .then((json: unknown) => {
        if (!cancelled) setBrut(json);
      })
      .catch(() => {
        if (!cancelled) setBrut(null);
      });
    return () => {
      cancelled = true;
    };
  }, [itemId, isLocalPlayback, rootReady]);

  return useMemo(
    () => (isLocalPlayback && itemId ? resolveLocalSegmentsPayload(raw, itemId, item) : EMPTY),
    [isLocalPlayback, raw, item, itemId],
  );
}
