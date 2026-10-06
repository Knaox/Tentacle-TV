import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { HeroArtwork } from "@tentacle-tv/shared";
import { useJellyfinClient } from "./useJellyfinClient";
import type { ImageType } from "../jellyfin/urlBuilder";
import { tentacleApiFetch } from "./usePreferences";

/** Les images de repli d'un titre (`GET /api/hero/artwork/:itemId`). */
export function fetchHeroArtwork(itemId: string): Promise<HeroArtwork[]> {
  return tentacleApiFetch<{ images?: HeroArtwork[] }>(`/api/hero/artwork/${encodeURIComponent(itemId)}`).then(
    (res) => res.images ?? []
  );
}

/**
 * Le repli de la bannière d'accueil pour UN titre — le fond TMDB, puis toute
 * image que Jellyfin a du titre et de sa série. `enabled` : seulement quand
 * les images annoncées du titre manquent ou ont échoué (shared
 * `needsHeroArtwork`) — jamais une requête par titre affiché. Une heure en
 * cache : une image de titre ne change pas d'un passage à l'autre.
 */
export function useHeroArtwork(itemId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["hero-artwork", itemId],
    queryFn: () => fetchHeroArtwork(itemId as string),
    enabled: enabled && !!itemId,
    staleTime: 60 * 60 * 1000,
    retry: false,
  });
}

/** Aucun repli (identité stable). */
const NO_URLS: string[] = [];

/**
 * Le repli d'un titre en ADRESSES, pour les bannières à pile d'images (le
 * miroir, le mobile) : le fond TMDB tel quel, une image Jellyfin à la taille
 * demandée. `undefined` tant qu'il n'est pas là (ou pas demandé) ; un
 * serveur sans la route (ou en échec) : une liste vide.
 */
export function useHeroArtworkUrls(
  itemId: string | undefined,
  enabled: boolean,
  size: { width: number; quality: number }
): string[] | undefined {
  const client = useJellyfinClient();
  const query = useHeroArtwork(itemId, enabled);
  const { width, quality } = size;
  // Un repli déjà en cache reste servi, demande éteinte comprise : la
  // diapositive qui s'efface garde son image le temps du fondu.
  return useMemo(() => {
    if (query.data === undefined) return query.isError ? NO_URLS : undefined;
    return query.data.flatMap((art) => {
      if (art.kind === "tmdb") return [art.url];
      if (!HERO_IMAGE_TYPES.includes(art.type as ImageType)) return [];
      return [client.getImageUrl(art.itemId, art.type as ImageType, { width, quality, ...(art.index ? { index: art.index } : {}) })];
    });
  }, [query.isError, query.data, client, width, quality]);
}

const HERO_IMAGE_TYPES: readonly ImageType[] = ["Backdrop", "Thumb", "Primary", "Banner", "Art", "Screenshot", "Box"];
