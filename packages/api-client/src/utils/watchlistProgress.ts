import type { MediaItem } from "@tentacle-tv/shared";

/**
 * Où en est-on de chaque titre de Ma liste — la lecture commune au bureau, au
 * web et au mobile.
 *
 * Trois étapes seulement, et elles ne se recouvrent pas :
 * • `new`        — rien de vu ;
 * • `inProgress` — commencé, pas fini (la règle d'`IsResumable` dans
 *                  `collectionFilter` : position pour un film, épisodes vus
 *                  pour une série) ;
 * • `watched`    — marqué vu.
 *
 * Tout se lit dans le `UserData` déjà chargé par `useWatchlistAll` : aucune
 * requête de plus, même sur une liste de cinq cents titres.
 */
export type WatchStage = "new" | "inProgress" | "watched";

/** Le filtre d'étape de la page : une étape, ou toutes. */
export type WatchStageFilter = "all" | WatchStage;

export const WATCH_STAGE_FILTERS: readonly WatchStageFilter[] = ["all", "new", "inProgress", "watched"];

/** Dix millions de ticks Jellyfin par seconde. */
const TICKS_PER_MINUTE = 600_000_000;

export function watchStage(item: MediaItem): WatchStage {
  const data = item.UserData;
  if (data?.Played === true) return "watched";
  if (item.Type === "Series") return (data?.PlayCount ?? 0) > 0 ? "inProgress" : "new";
  const pct = data?.PlayedPercentage ?? 0;
  if ((data?.PlaybackPositionTicks ?? 0) > 0 || (pct > 0 && pct < 100)) return "inProgress";
  return "new";
}

/**
 * Le pourcentage à dessiner sur la barre, entre 0 et 100 — ou `null` quand le
 * serveur ne dit rien d'exploitable (série jamais ouverte, film neuf).
 *
 * Une série vue porte `Played` sans toujours porter 100 % : on l'affirme.
 */
export function watchProgress(item: MediaItem): number | null {
  const data = item.UserData;
  if (data?.Played === true) return 100;
  const pct = data?.PlayedPercentage;
  if (pct == null || !Number.isFinite(pct) || pct <= 0) return null;
  return Math.min(100, Math.max(0, pct));
}

/**
 * Ce qu'il reste : des minutes pour un film commencé, des épisodes pour une
 * série. `null` quand ce n'est pas mesurable — le libellé se tait alors
 * plutôt que d'annoncer un zéro faux.
 */
export type RemainingInfo = { kind: "minutes"; value: number } | { kind: "episodes"; value: number };

export function watchRemaining(item: MediaItem): RemainingInfo | null {
  if (watchStage(item) !== "inProgress") return null;
  if (item.Type === "Series") {
    const left = item.UserData?.UnplayedItemCount;
    return left != null && left > 0 ? { kind: "episodes", value: left } : null;
  }
  const total = item.RunTimeTicks ?? 0;
  const position = item.UserData?.PlaybackPositionTicks ?? 0;
  if (total <= 0 || position <= 0 || position >= total) return null;
  const minutes = Math.max(1, Math.round((total - position) / TICKS_PER_MINUTE));
  return { kind: "minutes", value: minutes };
}

export interface WatchlistSummary {
  total: number;
  new: number;
  inProgress: number;
  watched: number;
}

export function summarizeWatchlist(items: readonly MediaItem[]): WatchlistSummary {
  const summary: WatchlistSummary = { total: items.length, new: 0, inProgress: 0, watched: 0 };
  for (const item of items) summary[watchStage(item)] += 1;
  return summary;
}

/**
 * Filtre d'étape. Même référence quand rien n'est demandé : la grille ne se
 * re-rend pas pour un tableau recopié à l'identique (cf. `filterCollection`).
 */
export function filterByWatchStage(items: MediaItem[], stage: WatchStageFilter): MediaItem[] {
  if (stage === "all") return items;
  return items.filter((item) => watchStage(item) === stage);
}

/**
 * La file « Reprendre » : les titres commencés, le dernier regardé en tête.
 * Sans `LastPlayedDate`, l'ordre de la liste fait foi (tri stable).
 */
export function resumeQueue(items: readonly MediaItem[], limit = 12): MediaItem[] {
  return items
    .filter((item) => watchStage(item) === "inProgress")
    .map((item, index) => ({ item, index, at: Date.parse(item.UserData?.LastPlayedDate ?? "") }))
    .sort((a, b) => {
      const ta = Number.isNaN(a.at) ? -Infinity : a.at;
      const tb = Number.isNaN(b.at) ? -Infinity : b.at;
      return tb === ta ? a.index - b.index : tb - ta;
    })
    .slice(0, limit)
    .map((entry) => entry.item);
}

/** Lecture tolérante du paramètre d'adresse : une valeur inconnue vaut « tout ». */
export function parseWatchStageFilter(raw: string | null | undefined): WatchStageFilter {
  return (WATCH_STAGE_FILTERS as readonly string[]).includes(raw ?? "") ? (raw as WatchStageFilter) : "all";
}
