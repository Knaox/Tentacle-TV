import { useMemo } from "react";
import { useHeroArtwork, useJellyfinClient } from "@tentacle-tv/api-client";
import { heroImageOption, heroImagePlan, needsHeroArtwork, type HeroArtwork, type MediaItem } from "@tentacle-tv/shared";
import { heroOptionUrl } from "./resolveBackdrop";

/** Source du halo : l'image affichée, en tout petit (cf. HeroAmbilight). */
const HALO_SOURCE_WIDTH = 128;
/** Aucun repli (identité stable : le plan ne se refait pas à chaque rendu). */
const NO_ARTWORK: HeroArtwork[] = [];

export interface HeroImage {
  /** L'image à montrer ; `null` : aucune (encore), le fond de marque. */
  url: string | null;
  haloUrl: string | null;
  /** La clé de l'image montrée — ce qu'on signale quand elle échoue. */
  key: string | null;
  /** Plus rien à essayer, repli du serveur compris : le titre peut quitter la rotation. */
  exhausted: boolean;
}

/**
 * L'image d'un titre de la bannière d'accueil, selon le plan partagé
 * (`heroImagePlan`) : les images larges annoncées, puis — seulement quand
 * elles manquent ou ont toutes échoué — le repli du serveur (le fond TMDB,
 * sinon toute image que Jellyfin a du titre et de sa série), puis l'affiche.
 * Pendant que le repli se cherche, rien : l'affiche montrée puis remplacée
 * par un fond sauterait sous les yeux.
 */
export function useHeroImage(item: MediaItem | undefined, failed: ReadonlySet<string>): HeroImage {
  const client = useJellyfinClient();
  const needsArtwork = !!item && needsHeroArtwork(item, failed);
  const artwork = useHeroArtwork(item?.Id, needsArtwork);
  // Une erreur du serveur (ancien serveur sans la route, 404) vaut « aucun repli ».
  const fallback = needsArtwork ? (artwork.data ?? (artwork.isError ? NO_ARTWORK : undefined)) : undefined;
  const waiting = needsArtwork && fallback === undefined;

  return useMemo(() => {
    if (!item || waiting) return { url: null, haloUrl: null, key: null, exhausted: false };
    const option = heroImageOption(heroImagePlan(item, fallback), failed);
    if (!option) return { url: null, haloUrl: null, key: null, exhausted: true };
    return {
      url: heroOptionUrl(client, option),
      haloUrl: heroOptionUrl(client, option, HALO_SOURCE_WIDTH, 70),
      key: option.key,
      exhausted: false,
    };
  }, [item, waiting, fallback, failed, client]);
}
