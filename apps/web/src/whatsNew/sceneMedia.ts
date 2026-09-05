import { createContext, useContext, useMemo } from "react";
import {
  useFeaturedItems, useJellyfinClient, useResumeItems, useWatchProviders, useWatchedItems,
} from "@tentacle-tv/api-client";
import { PLATFORM_FAMILIES, resolvePosterImage } from "@tentacle-tv/shared";
import { heroBackdropUrl } from "../components/hero/resolveBackdrop";
import { buildPlatformCatalog, type PlatformCatalogEntry } from "../components/reco/platformCatalog";

/** Une vraie affiche de la bibliothèque, telle que les rangées de l'accueil la peignent. */
export interface ScenePoster {
  id: string;
  title: string;
  year: number | null;
  rating: number | null;
  url: string;
  /** 0..100 : la reprise en cours, s'il y en a une. */
  progress: number | null;
}

export interface SceneBackdrop {
  url: string;
  title: string;
}

export interface SceneMedia {
  posters: ScenePoster[];
  backdrop: SceneBackdrop | null;
  platforms: PlatformCatalogEntry[];
}

const EMPTY: SceneMedia = { posters: [], backdrop: null, platforms: [] };

export const SceneMediaContext = createContext<SceneMedia>(EMPTY);

/** Les vraies données des scènes — vides hors de l'app (test, crochet sans session) : le kit retombe sur ses dégradés. */
export function useSceneMedia(): SceneMedia {
  return useContext(SceneMediaContext);
}

/** L'affiche d'index `index`, en boucle sur ce qu'on a ; `null` sans donnée. */
export function posterAt(media: SceneMedia, index: number): ScenePoster | null {
  if (media.posters.length === 0) return null;
  return media.posters[index % media.posters.length];
}

/**
 * La source : les requêtes que l'accueil a DÉJÀ faites (sélection du bandeau,
 * reprises, déjà vus) et l'annuaire des plateformes — rien de nouveau n'est
 * demandé au serveur quand l'écran s'ouvre après un passage sur l'accueil.
 * Même recette d'URL que les cartes réelles : les affiches sont en cache.
 */
export function useSceneMediaSource(): SceneMedia {
  const client = useJellyfinClient();
  const featured = useFeaturedItems().data;
  const resume = useResumeItems().data;
  const watched = useWatchedItems().data;
  const providers = useWatchProviders().data;

  return useMemo(() => {
    const seen = new Set<string>();
    const posters: ScenePoster[] = [];
    for (const item of [...(featured ?? []), ...(resume ?? []), ...(watched ?? [])]) {
      if (seen.has(item.Id)) continue;
      const image = resolvePosterImage(item);
      if (!image) continue;
      seen.add(item.Id);
      posters.push({
        id: item.Id,
        title: item.Name,
        year: item.ProductionYear ?? null,
        rating: item.CommunityRating ?? null,
        url: client.getImageUrl(image.id, image.type, { height: 450, quality: 90, ...(image.tag ? { tag: image.tag } : {}) }),
        progress: item.UserData?.PlayedPercentage ?? null,
      });
    }
    const hero = featured?.[0];
    const backdropUrl = hero ? heroBackdropUrl(client, hero) : null;
    return {
      posters,
      backdrop: hero && backdropUrl ? { url: backdropUrl, title: hero.Name } : null,
      platforms: buildPlatformCatalog(PLATFORM_FAMILIES, providers),
    };
  }, [client, featured, resume, watched, providers]);
}
