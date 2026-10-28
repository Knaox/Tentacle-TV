/**
 * Octave — le port des pochettes du web (`ArtworkPreloader` d'api-client) : l'adresse résolue comme `Artwork`
 * l'affichera, puis chargée et décodée (`preloadArtwork`), dans le budget donné.
 */

import { useCallback } from "react";
import type { ArtworkPreloader } from "@tentacle-tv/api-client";
import { useArtworkResolver } from "./Artwork";
import { preloadArtwork } from "./artworkPreload";

export function useArtworkPreloader(): ArtworkPreloader {
  const resolve = useArtworkResolver();
  return useCallback<ArtworkPreloader>(
    (urls, budgetMs) => preloadArtwork(urls.map((u) => resolve(u ?? null)).filter((s): s is string => !!s), budgetMs),
    [resolve],
  );
}
