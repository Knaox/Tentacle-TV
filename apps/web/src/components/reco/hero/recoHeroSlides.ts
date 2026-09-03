import { useMemo } from "react";
import { useRecoPage } from "@tentacle-tv/api-client";
import type { RecoPageRow, RecoRowItem } from "@tentacle-tv/api-client";

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
const EMPTY_SELECTION: RecoHeroSelection = { slides: [], excludeKeys: EMPTY_KEYS, fallbackItem: undefined };

export interface RecoHeroSelection {
  slides: RecoRowItem[];
  /** Les items MONTRÉS dans le héros — la rangée « Pour vous » les exclut. */
  excludeKeys: string[];
  /** Aucun visuel large : l'ancienne carte héros sert de repli. */
  fallbackItem: RecoRowItem | undefined;
}

/** Pur : le héros d'une page, depuis sa rangée « Pour vous » (FILTRÉE si la
 *  page l'est — le héros suit le filtre). */
export function heroSelectionFromRows(rows: readonly RecoPageRow[] | undefined): RecoHeroSelection {
  const forYou = rows?.find((row) => row.key === "forYou")?.items;
  if (!forYou || forYou.length === 0) return EMPTY_SELECTION;
  const slides = selectHeroSlides(forYou);
  return {
    slides,
    excludeKeys: slides.length > 0 ? slides.map((s) => s.key) : EMPTY_KEYS,
    fallbackItem: slides.length === 0 ? forYou[0] : undefined,
  };
}

/**
 * Source de vérité du héros des recommandations — la MÊME entrée de cache
 * que la page (aucune requête en plus). Retours mémoïsés : une identité
 * neuve à chaque rendu re-rendrait la rangée en aval.
 */
export function useRecoHeroSlides(
  filter: readonly number[] | null,
  options: { enabled?: boolean } = {}
): RecoHeroSelection {
  const { data } = useRecoPage(filter, options);
  const rows = data?.rows;
  return useMemo(() => heroSelectionFromRows(rows), [rows]);
}
