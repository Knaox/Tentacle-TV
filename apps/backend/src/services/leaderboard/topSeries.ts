import { getJellyfinApiKey, getJellyfinUrl } from "../configStore";
import type { SerieFavorite } from "./types";

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

interface EpisodeVu {
  SeriesId?: string;
  SeriesName?: string;
  UserData?: { PlayCount?: number };
}

const cache = new Map<string, { series: SerieFavorite[]; a: number }>();

function retenir(userId: string, series: SerieFavorite[]): void {
  // Table bornée : au-delà de vingt comptes consultés, on oublie le plus ancien
  // plutôt que de laisser le cache grossir indéfiniment.
  if (cache.size >= CACHE_MAX) {
    const premier = cache.keys().next().value;
    if (premier) cache.delete(premier);
  }
  cache.set(userId, { series, a: Date.now() });
}

export async function seriesFavorites(userId: string): Promise<SerieFavorite[] | null> {
  const enCache = cache.get(userId);
  if (enCache && Date.now() - enCache.a < TTL_MS) return enCache.series;

  const base = getJellyfinUrl();
  const cle = getJellyfinApiKey();
  if (!base || !cle) return null;

  const parSerie = new Map<string, SerieFavorite>();
  let depart = 0;

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
      StartIndex: String(depart),
    });

    let items: EpisodeVu[];
    try {
      const res = await fetch(`${base}/Items?${p}`, {
        headers: { "X-Emby-Token": cle },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) return null;
      items = ((await res.json()) as { Items?: EpisodeVu[] }).Items ?? [];
    } catch {
      return null;
    }

    for (const ep of items) {
      if (!ep.SeriesId) continue;
      const courant = parSerie.get(ep.SeriesId) ?? {
        seriesId: ep.SeriesId,
        name: ep.SeriesName ?? "",
        episodesPlayed: 0,
        playCount: 0,
      };
      courant.episodesPlayed += 1;
      courant.playCount += Math.max(1, ep.UserData?.PlayCount ?? 1);
      parSerie.set(ep.SeriesId, courant);
    }

    if (items.length < PAGE) break;
    depart += PAGE;
  }

  const top = [...parSerie.values()]
    .sort((a, b) => b.playCount - a.playCount || b.episodesPlayed - a.episodesPlayed)
    .slice(0, 3);

  retenir(userId, top);
  return top;
}
