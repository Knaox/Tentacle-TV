import { useEffect, useMemo, useState } from "react";
import type { DownloadListEntry } from "@tentacle-tv/offline-core";
import { localResourceUrl, useDownloadsRootReady } from "../localFiles";

function probe(url: string | null): Promise<boolean> {
  if (url === null) return Promise.resolve(false);
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(true);
    image.onerror = () => resolve(false);
    image.src = url;
  });
}

/**
 * Les titres de la bannière dont le décor est VRAIMENT sur le disque : une
 * diapositive sans image serait un aplat sombre — elle ne vaut pas la place
 * qu'elle prend. Sondé une fois par jeu de titres ; le serveur loopback
 * répond en quelques millisecondes et le navigateur garde l'image décodée
 * pour la bannière qui la reçoit ensuite.
 */
export function useEntriesWithBackdrop(entries: readonly DownloadListEntry[]): {
  entries: DownloadListEntry[];
  settled: boolean;
} {
  const rootReady = useDownloadsRootReady();
  const key = entries.map((entry) => entry.itemId).join("|");
  const [found, setFound] = useState<{ key: string; ids: ReadonlySet<string> } | null>(null);

  useEffect(() => {
    if (!rootReady || key === "") return;
    let cancelled = false;
    const ids = key.split("|");
    void Promise.all(ids.map((id) => probe(localResourceUrl(`meta/${id}/backdrop.jpg`)).then((ok) => (ok ? id : null))))
      .then((results) => {
        if (!cancelled) setFound({ key, ids: new Set(results.filter((id): id is string => id !== null)) });
      });
    return () => {
      cancelled = true;
    };
  }, [key, rootReady]);

  return useMemo(() => {
    if (key === "") return { entries: [], settled: true };
    if (found === null) return { entries: [], settled: !rootReady };
    // Un nouveau jeu en cours de sonde garde les décors déjà connus : la
    // bannière ne disparaît pas le temps d'une sonde, elle s'enrichit après.
    return { entries: entries.filter((entry) => found.ids.has(entry.itemId)), settled: true };
  }, [entries, found, key, rootReady]);
}
