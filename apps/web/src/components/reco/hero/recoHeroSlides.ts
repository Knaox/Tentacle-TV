import { useMemo, useRef } from "react";
import { useRecoPage } from "@tentacle-tv/api-client";
import type { RecoPageRow, RecoRowItem } from "@tentacle-tv/api-client";

/** Diapositives au plus — au-delà, le carrousel dilue plus qu'il ne montre. */
const SLIDES_MAX = 5;

/**
 * Générateur déterministe (mulberry32) : même graine, même tirage. La graine
 * vit le temps d'un montage — un refetch en fond ne rebat pas les cartes sous
 * les yeux —, et chaque visite en tire une autre : la bannière change à
 * chaque rechargement.
 */
function seededRandom(seed: number): () => number {
  let a = Math.floor(seed * 2 ** 32) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Les diapositives du carrousel : un tirage AU HASARD parmi les items de
 * « Pour vous » ayant un visuel large (backdrop TMDB, sinon un item de
 * bibliothèque — son backdrop Jellyfin est tenté, un 404 est absorbé par le
 * calque d'image). La rangée « Pour vous », elle, reste ENTIÈRE : la bannière
 * ne lui prend rien, elle en met quelques titres en lumière.
 */
export function selectHeroSlides(items: readonly RecoRowItem[], seed: number, max = SLIDES_MAX): RecoRowItem[] {
  const pool = items.filter((item) => item.backdropPath || item.jellyfinItemId);
  const random = seededRandom(seed);
  // Fisher–Yates, borné : seuls les `max` premiers emplacements sont tirés.
  const count = Math.min(max, pool.length);
  for (let i = 0; i < count; i++) {
    const j = i + Math.floor(random() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

const EMPTY_SELECTION: RecoHeroSelection = { slides: [], fallbackItem: undefined };

export interface RecoHeroSelection {
  slides: RecoRowItem[];
  /** Aucun visuel large : l'ancienne carte héros sert de repli. */
  fallbackItem: RecoRowItem | undefined;
}

/** Pur : le héros d'une page, depuis sa rangée « Pour vous » (FILTRÉE si la
 *  page l'est — le héros suit le filtre), tiré avec `seed`. */
export function heroSelectionFromRows(rows: readonly RecoPageRow[] | undefined, seed: number): RecoHeroSelection {
  const forYou = rows?.find((row) => row.key === "forYou")?.items;
  if (!forYou || forYou.length === 0) return EMPTY_SELECTION;
  const slides = selectHeroSlides(forYou, seed);
  return { slides, fallbackItem: slides.length === 0 ? forYou[0] : undefined };
}

/**
 * Source de vérité du héros des recommandations — la MÊME entrée de cache
 * que la page (aucune requête en plus). Retours mémoïsés : une identité
 * neuve à chaque rendu re-rendrait la bannière en aval. Une graine par
 * MONTAGE : la sélection tient tant que la page est ouverte, chaque visite
 * en tire une autre.
 */
export function useRecoHeroSlides(
  filter: readonly number[] | null,
  options: { enabled?: boolean } = {}
): RecoHeroSelection {
  const { data } = useRecoPage(filter, options);
  const rows = data?.rows;
  const seed = useRef(Math.random());
  return useMemo(() => heroSelectionFromRows(rows, seed.current), [rows]);
}
