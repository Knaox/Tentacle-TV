import { useMemo } from "react";
import { useRecoRow } from "@tentacle-tv/api-client";
import type { RecoRowItem } from "@tentacle-tv/api-client";

/** Diapositives au plus — au-delà, le carrousel dilue plus qu'il ne montre. */
const SLIDES_MAX = 5;
/** Fenêtre de recherche : les meilleurs items d'abord, l'ordre est préservé. */
const SCAN_WINDOW = 8;

/**
 * Les diapositives du carrousel : les premiers items de « Pour vous » ayant un
 * visuel LARGE (backdrop TMDB, sinon un item de bibliothèque — son backdrop
 * Jellyfin est tenté, un 404 est absorbé par le calque d'image).
 */
export function selectHeroSlides(items: RecoRowItem[], max = SLIDES_MAX): RecoRowItem[] {
  const out: RecoRowItem[] = [];
  for (const item of items.slice(0, SCAN_WINDOW)) {
    if (out.length >= max) break;
    if (item.backdropPath || item.jellyfinItemId) out.push(item);
  }
  return out;
}

const EMPTY_KEYS: string[] = [];

/**
 * Source de vérité du héros des recommandations — MÊME clé de cache que la
 * rangée « Pour vous » (aucune requête en plus). Retours mémoïsés : une
 * identité neuve à chaque rendu re-rendrait la rangée en aval.
 */
export function useRecoHeroSlides() {
  const { data } = useRecoRow("forYou");
  const items = data?.items;
  return useMemo(() => {
    const all = items ?? [];
    const slides = selectHeroSlides(all);
    return {
      slides,
      /** Les items MONTRÉS dans le héros — la rangée « Pour vous » les exclut. */
      excludeKeys: slides.length ? slides.map((s) => s.key) : EMPTY_KEYS,
      /** Aucun visuel large : l'ancienne carte héros sert de repli. */
      fallbackItem: slides.length === 0 ? all[0] : undefined,
    };
  }, [items]);
}
