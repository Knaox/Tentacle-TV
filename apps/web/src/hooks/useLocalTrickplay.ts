/**
 * Manifeste trickplay LOCAL (lecture depuis le disque).
 *
 * Le backend enregistre au téléchargement `meta/<item>/trickplay.json`
 * (mediaSourceId, width, info au format `TrickplayInfo`) + les planches
 * `meta/<item>/trickplay/<width>/<index>.jpg`. Ce hook charge le manifeste via
 * le serveur loopback et fabrique un `TrickplayManifest` compatible avec
 * `pickBestTrickplayWidth`/`getTrickplayTile`, ainsi qu'un constructeur d'URL
 * de tuile pointant sur le serveur loopback. Actif uniquement en lecture
 * locale ; `null` sinon (le flux backend classique prend alors le relais).
 */

import { useEffect, useState } from "react";
import type { TrickplayInfo, TrickplayManifest } from "@tentacle-tv/shared";
import { localResourceUrl, useDownloadsRootReady } from "../downloads/localFiles";

interface LocalTrickplayManifest {
  mediaSourceId: string;
  width: number;
  info: TrickplayInfo;
}

export interface LocalTrickplay {
  manifest: TrickplayManifest;
  buildTileUrl: (tileIndex: number) => string | null;
}

export function useLocalTrickplay(localItemId: string | undefined): LocalTrickplay | null {
  const rootReady = useDownloadsRootReady();
  const [data, setData] = useState<LocalTrickplayManifest | null>(null);

  useEffect(() => {
    setData(null);
    if (!localItemId || !rootReady) return;
    const url = localResourceUrl(`meta/${localItemId}/trickplay.json`);
    if (!url) return;
    let cancelled = false;
    void fetch(url)
      .then((res) => (res.ok ? res.json() : null))
      .then((json: LocalTrickplayManifest | null) => {
        if (!cancelled && json?.info && json.width) setData(json);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      });
    return () => {
      cancelled = true;
    };
  }, [localItemId, rootReady]);

  if (!localItemId || !data) return null;

  // Réutilise la sélection/mosaïque partagées : un manifeste à une seule source
  // et une seule largeur suffit (le fichier local est mono-source).
  const manifest: TrickplayManifest = {
    [data.mediaSourceId]: { [String(data.width)]: data.info },
  };
  const buildTileUrl = (tileIndex: number): string | null =>
    localResourceUrl(`meta/${localItemId}/trickplay/${data.width}/${tileIndex}.jpg`);

  return { manifest, buildTileUrl };
}
