import { useEffect, useState } from "react";
import type { MediaItem } from "@tentacle-tv/shared";
import { localResourceUrl, useDownloadsRootReady } from "../downloads/localFiles";

/**
 * DTO Jellyfin de l'item depuis le snapshot disque (`meta/<id>/item.json`,
 * servi par le loopback 127.0.0.1) — REMPLACE useMediaItem en lecture locale :
 * zéro requête serveur, champs alignés au téléchargement (Chapters, Overview,
 * MediaStreams…). Retourne null si le snapshot est absent (téléchargement
 * hérité pas encore re-snapshotté par heal) : le lecteur reste utilisable via
 * la méta dénormalisée de LocalSource.
 */
export function useLocalMediaItem(
  itemId: string | undefined,
  isLocalPlayback: boolean,
): MediaItem | null {
  const rootReady = useDownloadsRootReady();
  const [item, setItem] = useState<MediaItem | null>(null);

  useEffect(() => {
    setItem(null);
    if (!itemId || !isLocalPlayback || !rootReady) return;
    const url = localResourceUrl(`meta/${itemId}/item.json`);
    if (!url) return;
    let cancelled = false;
    void fetch(url)
      .then((res) => (res.ok ? res.json() : null))
      .then((json: MediaItem | null) => {
        if (!cancelled && json?.Id) setItem(json);
      })
      .catch(() => {
        if (!cancelled) setItem(null);
      });
    return () => {
      cancelled = true;
    };
  }, [itemId, isLocalPlayback, rootReady]);

  return item;
}
