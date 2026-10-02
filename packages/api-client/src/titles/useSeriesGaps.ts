import { useMemo } from "react";
import { requestableGaps, seriesTitleKey, type TitleKey, type TitleProvider } from "@tentacle-tv/shared";
import { useTitleGaps } from "./useTitleGaps";

/** Une série de la bibliothèque à qui il manque des saisons qui se demandent. */
export interface SeriesGap {
  seriesId: string;
  key: TitleKey;
  name: string;
  /** Combien de saisons se demandent encore (« 2 saisons à demander »). */
  count: number;
}

/** Ce qu'il faut d'un titre de la page : un `MediaItem` ou un résultat de `/api/search`. */
export type SeriesGapItem = { Id: string; Name: string; Type?: string; ProviderIds?: Record<string, string> };

const NONE: ReadonlyMap<string, SeriesGap> = new Map();

/**
 * Les séries d'une page (résultats de recherche) à qui il manque des saisons à
 * demander, par identifiant de la bibliothèque — UNE question à l'extension
 * pour toute la page (`useTitleGaps`, contrat `titles.gaps`). Ce qui se
 * demande, c'est l'extension qui le dit ; sans elle, ou d'un serveur d'avant
 * (pas d'identité TMDB dans les résultats), la carte est vide.
 *
 * Commun au web, au mobile et à la TV : chacun y branche sa source
 * (`TitleProvider`) et sa langue.
 */
export function useSeriesGaps(
  provider: TitleProvider | null,
  items: readonly SeriesGapItem[],
  lang: string,
  options?: { enabled?: boolean },
): ReadonlyMap<string, SeriesGap> {
  const series = useMemo(() => {
    const out: Array<{ seriesId: string; key: TitleKey; name: string }> = [];
    for (const item of items) {
      const key = seriesTitleKey(item);
      if (key) out.push({ seriesId: item.Id, key, name: item.Name });
    }
    return out;
  }, [items]);
  const keys = useMemo(() => [...new Set(series.map((s) => s.key))], [series]);
  const gaps = useTitleGaps(provider, keys, lang, options);
  return useMemo(() => {
    if (!gaps || gaps.size === 0) return NONE;
    const out = new Map<string, SeriesGap>();
    for (const s of series) {
      const count = requestableGaps(gaps.get(s.key)).length;
      if (count > 0) out.set(s.seriesId, { ...s, count });
    }
    return out;
  }, [series, gaps]);
}
