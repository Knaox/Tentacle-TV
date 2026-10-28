/**
 * Octave mobile — le port des pochettes (`ArtworkPreloader` d'api-client) : les
 * adresses résolues comme `Artwork` les affichera, mises dans le cache
 * d'`expo-image` d'avance, dans le budget donné. La recherche révèle ainsi ses
 * rangées avec leurs images déjà là, comme le bureau.
 */

import { useCallback } from "react";
import { Image } from "expo-image";
import type { ArtworkPreloader } from "@tentacle-tv/api-client";
import { useArtworkResolver } from "./pagesEnv";

export function useMobileArtworkPreloader(): ArtworkPreloader {
  const resolve = useArtworkResolver();
  return useCallback<ArtworkPreloader>(
    (urls, budgetMs) => {
      const srcs = [...new Set(urls.map(resolve).filter((s): s is string => !!s))];
      if (srcs.length === 0) return Promise.resolve();
      const all = Image.prefetch(srcs, "memory-disk").then(() => undefined, () => undefined);
      return Promise.race([all, new Promise<void>((done) => setTimeout(done, budgetMs))]);
    },
    [resolve],
  );
}
