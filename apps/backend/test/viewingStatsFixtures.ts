import { flagBulkMarks } from "../src/services/viewingStats/dataset";
import type { Judgments, MeasuredEntry, PlayedEntry, StatsDataset, TitleInfo } from "../src/services/viewingStats/dataset";
import { LocalCalendar } from "../src/services/viewingStats/localCalendar";

/**
 * Les fabriques des tests du calcul — un jeu de données réduit à ce que
 * chaque règle regarde. Rien ici ne touche Jellyfin ni la base.
 */

// Lundi 28 septembre 2026, 14 h à Paris.
export const NOW = Date.parse("2026-09-28T12:00:00Z");
export const EPOCH = Date.parse("2026-08-05T00:00:00Z");
export const H = 3600;
export const cal = () => new LocalCalendar("Europe/Paris");

export function title(id: string, kind: "movie" | "series", over: Partial<TitleInfo> = {}): TitleInfo {
  return {
    id, kind, name: id, year: 2010, tmdbId: null, genreIds: [], origin: null, originalLanguage: null, anime: false, directors: [], cast: [],
    ...over,
  };
}

export function played(titleId: string, kind: "movie" | "episode", runtime: number, at: string | null, itemId = titleId): PlayedEntry {
  return { titleId, itemId, kind, runtimeSeconds: runtime, lastPlayedAt: at ? Date.parse(at) : null, bulk: false };
}

export function seg(titleId: string, kind: "movie" | "episode", start: string, seconds: number, over: Partial<MeasuredEntry> = {}): MeasuredEntry {
  const startedAt = Date.parse(start);
  return {
    titleId, itemId: titleId, kind, client: "Tentacle TV - Mobile", seconds,
    runtimeSeconds: null, audioLang: null, startedAt, lastSeenAt: startedAt + seconds * 1000, ...over,
  };
}

export const noJudgments = (): Judgments => ({ ratings: new Map(), verdicts: new Map(), favorites: new Set() });

export function dataset(
  titles: TitleInfo[],
  playedEntries: PlayedEntry[],
  measured: MeasuredEntry[] = [],
  epoch: number | null = EPOCH,
  judgments: Judgments = noJudgments()
): StatsDataset {
  flagBulkMarks(playedEntries);
  return { titles: new Map(titles.map((t) => [t.id, t])), played: playedEntries, measured, judgments, epoch };
}
