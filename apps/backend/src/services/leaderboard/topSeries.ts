import { getJellyfinApiKey, getJellyfinUrl } from "../configStore";
import type { FavoriteSeries } from "./types";

/**
 * Les séries les plus regardées d'un compte.
 *
 * Volontairement calculé À LA DEMANDE, quand on déplie une ligne, et non dans
 * la charge principale du classement : il faut parcourir les épisodes vus pour
 * les regrouper par série, ce qui n'a pas de sens à payer pour dix-neuf comptes
 * dont personne ne regardera le détail.
 *
 * Le pic mémoire est celui d'UNE page : chaque page alimente la table de
 * comptage puis est abandonnée — jamais la bibliothèque entière en mémoire.
 */

const PAGE = 500;
const PAGES_MAX = 40;
const TTL_MS = 10 * 60_000;
const CACHE_MAX = 20;

interface PlayedEpisode {
  SeriesId?: string;
  SeriesName?: string;
  UserData?: { PlayCount?: number };
}

const cache = new Map<string, { series: FavoriteSeries[]; a: number }>();

function remember(userId: string, series: FavoriteSeries[]): void {
  // Table bornée : au-delà de vingt comptes consultés, on oublie le plus ancien
  // plutôt que de laisser le cache grossir indéfiniment.
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(userId, { series, a: Date.now() });
}

export async function favoriteSeries(userId: string): Promise<FavoriteSeries[] | null> {
  const cached = cache.get(userId);
  if (cached && Date.now() - cached.a < TTL_MS) return cached.series;

  const base = getJellyfinUrl();
  const key = getJellyfinApiKey();
  if (!base || !key) return null;

  const perSeries = new Map<string, FavoriteSeries>();
  let startIndex = 0;

  for (let page = 0; page < PAGES_MAX; page++) {
    const p = new URLSearchParams({
      userId,
      Recursive: "true",
      IncludeItemTypes: "Episode",
      Filters: "IsPlayed",
      Fields: "SeriesName",
      EnableImages: "false",
      EnableUserData: "true",
      EnableTotalRecordCount: "false",
      Limit: String(PAGE),
      StartIndex: String(startIndex),
    });

    let items: PlayedEpisode[];
    try {
      const res = await fetch(`${base}/Items?${p}`, {
        headers: { "X-Emby-Token": key },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) return null;
      items = ((await res.json()) as { Items?: PlayedEpisode[] }).Items ?? [];
    } catch {
      return null;
    }

    for (const ep of items) {
      if (!ep.SeriesId) continue;
      const current = perSeries.get(ep.SeriesId) ?? {
        seriesId: ep.SeriesId,
        name: ep.SeriesName ?? "",
        episodesPlayed: 0,
        playCount: 0,
      };
      current.episodesPlayed += 1;
      current.playCount += Math.max(1, ep.UserData?.PlayCount ?? 1);
      perSeries.set(ep.SeriesId, current);
    }

    if (items.length < PAGE) break;
    startIndex += PAGE;
  }

  const top = [...perSeries.values()]
    .sort((a, b) => b.playCount - a.playCount || b.episodesPlayed - a.episodesPlayed)
    .slice(0, 3);

  remember(userId, top);
  return top;
}
