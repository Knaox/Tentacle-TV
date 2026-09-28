import { isAnimeJellyfin } from "../reco/facets";
import { flagBulkMarks } from "./dataset";
import type { PlayedEntry, TitleInfo } from "./dataset";
import { genreIdsFromNames } from "./genreNames";
import { scanItems, tmdbIdOf, TICKS_PER_SECOND } from "./jellyfinScan";
import type { JellyfinItem } from "./jellyfinScan";

/** Ce que Jellyfin sait de l'historique d'un compte, replié page par page. */
export interface PlayedHistory {
  played: PlayedEntry[];
  /** Films vus, déjà décrits (genres, année, id TMDB) par le parcours. */
  movies: Map<string, TitleInfo>;
  /** Séries rencontrées → leur nom, décrites plus tard par identifiants. */
  seriesNames: Map<string, string>;
  /** Favoris Jellyfin : leur nombre, et le pont TMDB → Jellyfin des titres aimés. */
  favorites: { count: number; byTmdbKey: Map<string, string> };
}

const dateOf = (item: JellyfinItem): number | null => {
  const raw = item.UserData?.LastPlayedDate;
  const ms = raw ? Date.parse(raw) : NaN;
  return Number.isFinite(ms) ? ms : null;
};

const runtimeOf = (item: JellyfinItem): number => (item.RunTimeTicks ? item.RunTimeTicks / TICKS_PER_SECOND : 0);

export function movieInfo(item: JellyfinItem): TitleInfo {
  return {
    id: item.Id,
    kind: "movie",
    name: item.Name ?? "",
    year: item.ProductionYear ?? null,
    tmdbId: tmdbIdOf(item),
    genreIds: genreIdsFromNames(item.Genres ?? []),
    language: null,
    anime: isAnimeJellyfin(item),
    directors: [],
    cast: [],
  };
}

/**
 * Trois parcours de front : films vus, épisodes vus, favoris. Champs réduits
 * au strict nécessaire, images coupées ; chaque page est repliée en entrées
 * compactes (un titre, une durée, une date) puis abandonnée.
 */
export async function fetchPlayedHistory(userId: string): Promise<PlayedHistory> {
  const played: PlayedEntry[] = [];
  const movies = new Map<string, TitleInfo>();
  const seriesNames = new Map<string, string>();
  const byTmdbKey = new Map<string, string>();
  let favoriteCount = 0;

  await Promise.all([
    scanItems(userId, { IncludeItemTypes: "Movie", Filters: "IsPlayed", Fields: "Genres,ProviderIds,ProductionYear" }, (items) => {
      for (const it of items) {
        movies.set(it.Id, movieInfo(it));
        played.push({ titleId: it.Id, itemId: it.Id, kind: "movie", runtimeSeconds: runtimeOf(it), lastPlayedAt: dateOf(it), bulk: false });
      }
    }),
    scanItems(userId, { IncludeItemTypes: "Episode", Filters: "IsPlayed" }, (items) => {
      for (const it of items) {
        if (!it.SeriesId) continue;
        if (!seriesNames.has(it.SeriesId)) seriesNames.set(it.SeriesId, it.SeriesName ?? "");
        played.push({ titleId: it.SeriesId, itemId: it.Id, kind: "episode", runtimeSeconds: runtimeOf(it), lastPlayedAt: dateOf(it), bulk: false });
      }
    }),
    scanItems(userId, { IncludeItemTypes: "Movie,Series", Filters: "IsFavorite", Fields: "ProviderIds" }, (items) => {
      favoriteCount += items.length;
      for (const it of items) {
        const tmdb = tmdbIdOf(it);
        if (tmdb) byTmdbKey.set(`${it.Type === "Series" ? "tv" : "movie"}:${tmdb}`, it.Id);
      }
    }),
  ]);

  flagBulkMarks(played);
  return { played, movies, seriesNames, favorites: { count: favoriteCount, byTmdbKey } };
}
