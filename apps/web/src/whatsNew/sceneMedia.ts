import { createContext, useContext, useMemo } from "react";
import {
  useFeaturedItems, useJellyfinClient, useMediaItem, useResumeItems, useWatchProviders, useWatchedItems,
} from "@tentacle-tv/api-client";
import { PLATFORM_FAMILIES, resolvePosterImage } from "@tentacle-tv/shared";
import { heroBackdropUrl } from "../components/hero/resolveBackdrop";
import { buildPlatformCatalog, type PlatformCatalogEntry } from "@tentacle-tv/api-client";
import { toSceneDetail, type SceneDetail } from "./sceneDetail";

export type { SceneDetail, ScenePerson } from "./sceneDetail";

/** Une vraie affiche de la bibliothèque, telle que les rangées de l'accueil la peignent. */
export interface ScenePoster {
  id: string;
  title: string;
  year: number | null;
  rating: number | null;
  url: string;
  /** 0..100 : la reprise en cours, s'il y en a une. */
  progress: number | null;
  /** Le décor du titre, à la recette des vignettes « Reprendre » de Ma liste ; `null` sans décor. */
  backdropUrl: string | null;
}

export interface SceneBackdrop {
  url: string;
  title: string;
}

export interface SceneMedia {
  posters: ScenePoster[];
  backdrop: SceneBackdrop | null;
  platforms: PlatformCatalogEntry[];
  /** La fiche complète du titre du bandeau (logo, casting, galerie) ; `null` tant qu'elle n'est pas là. */
  detail: SceneDetail | null;
}

const EMPTY: SceneMedia = { posters: [], backdrop: null, platforms: [], detail: null };

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
 *
 * Une seule lecture de plus : la fiche du titre du bandeau (`useMediaItem`,
 * la requête même de la page de fiche — en cache si on l'a ouverte), pour son
 * logo, son casting et ses décors.
 */
export function useSceneMediaSource(): SceneMedia {
  const client = useJellyfinClient();
  const featured = useFeaturedItems().data;
  const resume = useResumeItems().data;
  const watched = useWatchedItems().data;
  const providers = useWatchProviders().data;
  const heroItem = useMediaItem(featured?.[0]?.Id).data;

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
        backdropUrl: item.BackdropImageTags?.length
          ? client.getImageUrl(item.Id, "Backdrop", { width: 640, quality: 80 })
          : null,
      });
    }
    const hero = featured?.[0];
    const backdropUrl = hero ? heroBackdropUrl(client, hero) : null;
    return {
      posters,
      backdrop: hero && backdropUrl ? { url: backdropUrl, title: hero.Name } : null,
      platforms: buildPlatformCatalog(PLATFORM_FAMILIES, providers),
      detail: heroItem ? toSceneDetail(client, heroItem) : null,
    };
  }, [client, featured, resume, watched, providers, heroItem]);
}
