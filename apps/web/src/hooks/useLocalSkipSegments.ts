import { useEffect, useMemo, useState } from "react";
import { normalizeSkipSegments, type RawSkipSources, type SkipSegments } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { localResourceUrl, useDownloadsRootReady } from "../downloads/localFiles";

const NONE: SkipSegments = { intro: null, credits: null };

/**
 * Segments « passer l'intro / passer le générique » depuis le snapshot disque
 * (`meta/<id>/segments.json`, payloads BRUTS des trois sources, loopback) —
 * zéro réseau en lecture locale. Même normalisation que le chemin serveur
 * (normalizeSkipSegments) ; à défaut de fichier (téléchargement hérité pas
 * encore re-snapshotté), repli sur les chapitres du DTO local.
 */
export function useLocalSkipSegments(
  itemId: string | undefined,
  item: MediaItem | undefined,
  isLocalPlayback: boolean,
): SkipSegments {
  const rootReady = useDownloadsRootReady();
  const [raw, setRaw] = useState<RawSkipSources | null>(null);

  useEffect(() => {
    setRaw(null);
    if (!itemId || !isLocalPlayback || !rootReady) return;
    const url = localResourceUrl(`meta/${itemId}/segments.json`);
    if (!url) return;
    let cancelled = false;
    void fetch(url)
      .then((res) => (res.ok ? res.json() : null))
      .then((json: RawSkipSources | null) => {
        if (!cancelled) setRaw(json);
      })
      .catch(() => {
        if (!cancelled) setRaw(null);
      });
    return () => {
      cancelled = true;
    };
  }, [itemId, isLocalPlayback, rootReady]);

  return useMemo(
    () => (isLocalPlayback ? normalizeSkipSegments(raw ?? {}, item?.Chapters) : NONE),
    [isLocalPlayback, raw, item],
  );
}
