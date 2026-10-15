import { useMemo, useRef } from "react";
import { topRecoHeroItems, type RecoHeroKind } from "@tentacle-tv/shared";
import type { RecoPageRow } from "../hooks/useRecoPage";
import type { RecoRowItem } from "../hooks/recoTypes";
import { useRecoPageVisit } from "./useRecoPageVisit";

/** Diapositives au plus — au-delà, le carrousel dilue plus qu'il ne montre. */
const SLIDES_MAX = 5;

/**
 * Le rang d'un titre dans le tirage d'une graine : un hachage (FNV-1a, puis
 * le mélange final de mulberry32) de la graine et de la CLÉ du titre, jamais
 * de sa place dans la rangée. La graine vit le temps d'un montage et chaque
 * visite en tire une autre : la bannière change à chaque passage. Comme le
 * rang ne dépend que du titre, une rangée qui perd un titre garde le tirage
 * des autres — refuser une diapositive ne rebat pas le carrousel sous les yeux.
 */
function drawRank(seed: number, key: string): number {
  let h = (Math.floor(seed * 2 ** 32) ^ 0x811c9dc5) >>> 0;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 0x01000193) >>> 0;
  let t = (h + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/**
 * Les diapositives du carrousel : un tirage AU HASARD parmi les items de
 * « Pour vous » ayant un visuel large (backdrop TMDB, sinon un item de
 * bibliothèque — son backdrop Jellyfin est tenté, un 404 est absorbé par le
 * calque d'image). La rangée « Pour vous », elle, reste ENTIÈRE : la bannière
 * ne lui prend rien, elle en met quelques titres en lumière.
 */
/** Un visuel large à montrer : le backdrop TMDB, sinon celui de l'item de bibliothèque. */
const hasWideVisual = (item: RecoRowItem): boolean => !!(item.backdropPath || item.jellyfinItemId);

export function selectHeroSlides(items: readonly RecoRowItem[], seed: number, max = SLIDES_MAX): RecoRowItem[] {
  return items
    .filter(hasWideVisual)
    .map((item) => ({ item, rank: drawRank(seed, item.key) }))
    .sort((a, b) => a.rank - b.rank)
    .slice(0, max)
    .map(({ item }) => item);
}

const EMPTY_SELECTION: RecoHeroSelection = { slides: [], fallbackItem: undefined };

export interface RecoHeroSelection {
  slides: RecoRowItem[];
  /** Aucun visuel large : l'ancienne carte héros sert de repli. */
  fallbackItem: RecoRowItem | undefined;
}

/** Pur : le héros d'une page, depuis sa rangée « Pour vous » (FILTRÉE si la
 *  page l'est — le héros suit le filtre), tiré avec `seed`. Un genre (`movie`,
 *  `tv` : les sources « Pour vous — Films / Séries » de l'accueil) ne tire
 *  rien : les mieux recommandés, dans l'ordre servi (shared
 *  `topRecoHeroItems`) ; sans eux, rien — l'appelant retombe sur la reprise. */
export function heroSelectionFromRows(
  rows: readonly RecoPageRow[] | undefined,
  seed: number,
  kind: RecoHeroKind = "all",
): RecoHeroSelection {
  if (kind !== "all") {
    const slides = topRecoHeroItems(rows, kind, { max: SLIDES_MAX, accept: hasWideVisual });
    return slides.length > 0 ? { slides, fallbackItem: undefined } : EMPTY_SELECTION;
  }
  const forYou = rows?.find((row) => row.key === "forYou")?.items;
  if (!forYou || forYou.length === 0) return EMPTY_SELECTION;
  const slides = selectHeroSlides(forYou, seed);
  return { slides, fallbackItem: slides.length === 0 ? forYou[0] : undefined };
}

/**
 * Source de vérité du héros des recommandations — la MÊME entrée de cache
 * que la page (aucune requête en plus), lue comme une VISITE
 * (`useRecoPageVisit`) : une page recalculée en fond n'y change rien sous les
 * yeux. Retours mémoïsés : une identité neuve à chaque rendu re-rendrait la
 * bannière en aval. Une graine par MONTAGE : la sélection tient tant que la
 * page est ouverte, chaque visite en tire une autre.
 */
export function useRecoHeroSlides(
  filter: readonly number[] | null,
  options: { enabled?: boolean; kind?: RecoHeroKind } = {}
): RecoHeroSelection {
  const { kind = "all", ...visit } = options;
  const { data } = useRecoPageVisit(filter, visit);
  const rows = data?.rows;
  const seed = useRef(Math.random());
  return useMemo(() => heroSelectionFromRows(rows, seed.current, kind), [rows, kind]);
}
