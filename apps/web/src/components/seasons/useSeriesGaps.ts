import { useMemo } from "react";
import { useTitleGaps } from "@tentacle-tv/api-client";
import { requestableGaps, seriesTitleKey, type TitleKey } from "@tentacle-tv/shared";
import { useTitleProvider } from "../cards/external/useTitleProvider";

/** Une série de la bibliothèque à qui il manque des saisons qui se demandent. */
export interface SeriesGap {
  seriesId: string;
  key: TitleKey;
  name: string;
  /** Combien de saisons se demandent encore (« 2 saisons à demander »). */
  count: number;
}

type SeriesLike = { Id: string; Name: string; Type?: string; ProviderIds?: Record<string, string> };

const NONE: ReadonlyMap<string, SeriesGap> = new Map();

/**
 * Les séries d'une page de résultats à qui il manque des saisons à demander,
 * par identifiant de la bibliothèque — UNE question à l'extension pour toute
 * la page (`useTitleGaps`, contrat `titles.gaps`). Ce qui se demande, c'est
 * l'extension qui le dit ; sans elle (ou d'un serveur d'avant, sans identité
 * TMDB dans les résultats), rien.
 */
export function useSeriesGaps(items: readonly SeriesLike[]): ReadonlyMap<string, SeriesGap> {
  const { provider, lang } = useTitleProvider();
  const series = useMemo(() => {
    const out: Array<{ seriesId: string; key: TitleKey; name: string }> = [];
    for (const item of items) {
      const key = seriesTitleKey(item);
      if (key) out.push({ seriesId: item.Id, key, name: item.Name });
    }
    return out;
  }, [items]);
  const keys = useMemo(() => [...new Set(series.map((s) => s.key))], [series]);
  const gaps = useTitleGaps(provider, keys, lang);
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
