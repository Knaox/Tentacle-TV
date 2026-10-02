import { useSeriesGaps as useGaps, type SeriesGap, type SeriesGapItem } from "@tentacle-tv/api-client";
import { useTitleProvider } from "../cards/external/useTitleProvider";

export type { SeriesGap } from "@tentacle-tv/api-client";

/**
 * Les séries d'une page de résultats à qui il manque des saisons à demander
 * (`useSeriesGaps` d'api-client), sur l'extension et la langue du web.
 */
export function useSeriesGaps(items: readonly SeriesGapItem[]): ReadonlyMap<string, SeriesGap> {
  const { provider, lang } = useTitleProvider();
  return useGaps(provider, items, lang);
}
