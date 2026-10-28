/**
 * La RÉPARATION d'une photo de profil gardée tronquée par le cache disque d'expo-image (cf.
 * `imageCompleteness.ts`) : au chargement d'une URL, une fois par session, le fichier du cache est relu ; s'il
 * ne se termine pas comme son format le dit, il est retiré (disque, puis mémoire) et l'image remontée par une
 * nouvelle `key` — elle repart du serveur, entière. Rien sur le web ; sans fichier en cache, rien.
 */

import { useCallback, useState } from "react";
import { Platform } from "react-native";
import { Image } from "expo-image";
import { File } from "expo-file-system";
import { imageBytesComplete } from "./imageCompleteness";

/** Les URL déjà relues : une seule lecture du fichier par URL et par session. */
const checked = new Set<string>();

/** Le fichier du cache, s'il est tronqué, retiré ; vrai si une réparation a eu lieu. */
async function dropIfTruncated(url: string): Promise<boolean> {
  const path = await Image.getCachePathAsync(url);
  if (!path) return false;
  const file = new File(path.startsWith("file://") ? path : `file://${path}`);
  if (!file.exists || imageBytesComplete(await file.bytes())) return false;
  file.delete();
  await Image.clearMemoryCache();
  return true;
}

/** `key` à poser sur l'`<Image>` (elle change après une réparation), `onLoad` à brancher. */
export function useCachedPhotoRepair(url: string | null): { key: string; onLoad: () => void } {
  const [repairs, setRepairs] = useState(0);
  const onLoad = useCallback(() => {
    if (url === null || Platform.OS === "web" || checked.has(url)) return;
    checked.add(url);
    dropIfTruncated(url)
      .then((repaired) => {
        if (repaired) setRepairs((n) => n + 1);
      })
      .catch(() => {
        // Lecture impossible : l'image reste telle quelle, rien à dire.
      });
  }, [url]);
  return { key: `${url ?? "none"}#${repairs}`, onLoad };
}
