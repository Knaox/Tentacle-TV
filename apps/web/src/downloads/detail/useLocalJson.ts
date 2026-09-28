import { useEffect, useState } from "react";
import { localResourceUrl, useDownloadsRootReady } from "../localFiles";

export interface LocalJson<T> {
  data: T | null;
  /** Lu, ou absent pour de bon (transfert hérité sans snapshot). */
  settled: boolean;
}

/**
 * Un snapshot du disque (`item.json`, `series.json`, `season.json`) et son
 * verdict : la fiche locale attend de savoir s'il existe avant de se dessiner,
 * plutôt que de rendre un titre nu puis de le remplacer.
 */
export function useLocalJson<T>(itemId: string | undefined, fileName: string): LocalJson<T> {
  const rootReady = useDownloadsRootReady();
  const [state, setState] = useState<LocalJson<T>>({ data: null, settled: false });

  useEffect(() => {
    setState({ data: null, settled: false });
    if (!itemId || !rootReady) return;
    const url = localResourceUrl(`meta/${itemId}/${fileName}`);
    if (!url) return;
    let cancelled = false;
    void fetch(url)
      .then((res) => (res.ok ? (res.json() as Promise<T>) : null))
      .catch(() => null)
      .then((data) => {
        if (!cancelled) setState({ data, settled: true });
      });
    return () => {
      cancelled = true;
    };
  }, [itemId, fileName, rootReady]);

  return state;
}
