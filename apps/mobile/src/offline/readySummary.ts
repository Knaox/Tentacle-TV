import { entryTitle } from "./entryTitle";
import type { OfflineEntry } from "./engineApi";

/** Ce qu'une notification « prêt » doit dire, sous forme de clé et de valeurs. */
export interface ReadySummary {
  key: "readyNotifBody" | "readyNotifBodySeries";
  params: Record<string, string | number>;
}

/**
 * Résume un lot de titres devenus lisibles en UNE phrase.
 *
 * Trois cas, du plus précis au plus général : un seul titre, qui se nomme ;
 * plusieurs épisodes d'une même série, qui se comptent sous son nom — c'est le
 * cas courant quand on garde une saison ; un mélange, qui se compte seulement.
 *
 * Le pluriel est laissé à i18next (`count`), qui a les règles de chaque langue.
 */
export function summarizeReady(entries: readonly OfflineEntry[]): ReadySummary | null {
  if (entries.length === 0) return null;
  if (entries.length === 1) {
    return { key: "readyNotifBody", params: { count: 1, title: entryTitle(entries[0]!) } };
  }

  const series = new Set<string>();
  for (const entry of entries) {
    // Un film, ou un épisode sans nom de série : on ne peut plus regrouper.
    if (entry.kind !== "episode" || !entry.seriesName) return countOnly(entries.length);
    series.add(entry.seriesName);
  }
  const only = series.size === 1 ? [...series][0] : null;
  if (only === undefined || only === null) return countOnly(entries.length);
  return { key: "readyNotifBodySeries", params: { count: entries.length, series: only } };
}

function countOnly(count: number): ReadySummary {
  return { key: "readyNotifBody", params: { count } };
}
