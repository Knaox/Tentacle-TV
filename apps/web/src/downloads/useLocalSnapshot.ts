/**
 * Lecture d'un snapshot Jellyfin enregistré sur le disque au téléchargement
 * (`meta/<itemId>/item.json`, `series.json`, `season.json`) via le serveur
 * loopback. Aucune requête serveur : fonctionne à l'identique hors ligne.
 */

import { useEffect, useState } from "react";
import { localResourceUrl } from "./localFiles";

/** Champs effectivement lus par les écrans locaux. */
export interface LocalSnapshot {
  Name?: string;
  Overview?: string;
  ProductionYear?: number;
  RunTimeTicks?: number;
  SeriesName?: string;
  ParentIndexNumber?: number;
  IndexNumber?: number;
  OfficialRating?: string;
  CommunityRating?: number;
}

export function useLocalSnapshot(
  itemId: string | undefined,
  fileName: string,
  rootReady: boolean,
): LocalSnapshot | null {
  const [data, setData] = useState<LocalSnapshot | null>(null);

  useEffect(() => {
    setData(null);
    if (!itemId || !rootReady) return;
    const url = localResourceUrl(`meta/${itemId}/${fileName}`);
    if (!url) return;
    let cancelled = false;
    void fetch(url)
      .then((res) => (res.ok ? res.json() : null))
      .then((json: LocalSnapshot | null) => {
        if (!cancelled) setData(json);
      })
      .catch(() => {
        // Snapshot absent (téléchargement hérité) : l'écran reste utilisable
        // avec les seules données de la base locale.
        if (!cancelled) setData(null);
      });
    return () => {
      cancelled = true;
    };
  }, [itemId, fileName, rootReady]);

  return data;
}
