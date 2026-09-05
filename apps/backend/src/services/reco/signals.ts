import { getJellyfinApiKey, getJellyfinUrl } from "../configStore";
import type { JellyfinFacetSource } from "./facets";

/** Ce qu'un scan de signaux rapporte d'un item — facettes + UserData. */
export interface SignalItem extends JellyfinFacetSource {
  Id: string;
  Type?: string;
  SeriesId?: string;
  ProviderIds?: Record<string, string>;
  RunTimeTicks?: number;
  UserData?: {
    PlayCount?: number;
    Played?: boolean;
    IsFavorite?: boolean;
    Likes?: boolean;
    PlaybackPositionTicks?: number;
    LastPlayedDate?: string;
  };
}

interface PageItems {
  Items?: SignalItem[];
  TotalRecordCount?: number;
}

/** Une page de 500 : au-delà, Jellyfin ralentit (même choix que coreStats). */
const PAGE = 500;
const PAGES_MAX = 20;

const FACET_FIELDS = "Genres,Studios,ProductionYear,ProviderIds";

async function pagedUserItems(userId: string, params: string): Promise<SignalItem[]> {
  const url = getJellyfinUrl();
  const apiKey = getJellyfinApiKey();
  if (!url || !apiKey) return [];

  const items: SignalItem[] = [];
  for (let page = 0; page < PAGES_MAX; page++) {
    const res = await fetch(
      `${url}/Items?userId=${userId}&Recursive=true&EnableImages=false&EnableUserData=true` +
        `&Fields=${FACET_FIELDS}&${params}&StartIndex=${page * PAGE}&Limit=${PAGE}`,
      { headers: { "X-Emby-Token": apiKey } }
    );
    if (!res.ok) break;
    const data = (await res.json()) as PageItems;
    const batch = data.Items ?? [];
    items.push(...batch);
    if (items.length >= (data.TotalRecordCount ?? 0) || batch.length < PAGE) break;
  }
  return items;
}

export interface UserSignals {
  favorites: SignalItem[];
  watchlist: SignalItem[];
  playedMovies: SignalItem[];
  resumable: SignalItem[];
  /** seriesId -> nombre d'épisodes vus (série « suivie » à partir de 3). */
  episodesPlayedBySeries: Map<string, number>;
  /** seriesId -> date ISO du dernier épisode vu : la décroissance du signal. */
  lastPlayedBySeries: Map<string, string>;
  /** Fiches Series de la bibliothèque, pour porter les signaux d'épisodes. */
  seriesById: Map<string, SignalItem>;
}

/**
 * Tous les signaux implicites d'un compte, en cinq scans paginés à la clé
 * admin (le paramètre `userId` rapporte le UserData de CE compte — même
 * mécanique que getUserWatchlist). Chaque scan est borné ; un échec rend une
 * liste vide, jamais une exception : un profil partiel vaut mieux que pas de
 * profil.
 */
export async function fetchUserSignals(userId: string): Promise<UserSignals> {
  const [favorites, watchlist, playedMovies, resumable, playedEpisodes, allSeries] =
    await Promise.all([
      pagedUserItems(userId, "Filters=IsFavorite&IncludeItemTypes=Movie,Series"),
      pagedUserItems(userId, "Filters=Likes&IncludeItemTypes=Movie,Series"),
      pagedUserItems(userId, "Filters=IsPlayed&IncludeItemTypes=Movie"),
      pagedUserItems(userId, "Filters=IsResumable&IncludeItemTypes=Movie,Episode"),
      pagedUserItems(userId, "Filters=IsPlayed&IncludeItemTypes=Episode&EnableImages=false"),
      pagedUserItems(userId, "IncludeItemTypes=Series"),
    ]);

  const episodesPlayedBySeries = new Map<string, number>();
  const lastPlayedBySeries = new Map<string, string>();
  for (const ep of playedEpisodes) {
    if (!ep.SeriesId) continue;
    episodesPlayedBySeries.set(ep.SeriesId, (episodesPlayedBySeries.get(ep.SeriesId) ?? 0) + 1);
    // Le plus récent des épisodes vus date la série entière.
    const last = ep.UserData?.LastPlayedDate;
    const prev = lastPlayedBySeries.get(ep.SeriesId);
    if (last && (!prev || Date.parse(last) > Date.parse(prev))) {
      lastPlayedBySeries.set(ep.SeriesId, last);
    }
  }

  const seriesById = new Map<string, SignalItem>();
  for (const s of allSeries) seriesById.set(s.Id, s);

  return {
    favorites,
    watchlist,
    playedMovies,
    resumable,
    episodesPlayedBySeries,
    lastPlayedBySeries,
    seriesById,
  };
}

/** tmdbId d'un item Jellyfin (ProviderIds.Tmdb), ou null. */
export function tmdbIdOf(item: SignalItem): number | null {
  const raw = item.ProviderIds?.Tmdb;
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}
