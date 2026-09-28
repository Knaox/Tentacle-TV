import { isAnimeJellyfin } from "../reco/facets";
import type { ViewingStatsTitle } from "./contract";
import type { TitleInfo } from "./dataset";
import { genreIdsFromNames } from "./genreNames";
import { itemsByIds, tmdbIdOf } from "./jellyfinScan";
import { movieInfo } from "./playedHistory";

/**
 * Décrit par identifiants les titres que les parcours n'ont pas décrits : les
 * séries des épisodes vus, et les films mesurés sans être marqués « vus ». Un
 * titre supprimé de la bibliothèque depuis garde le nom connu par ailleurs
 * (épisode, séance mesurée) et reste compté — sans genre.
 */
export async function describeTitles(
  userId: string,
  seriesNames: Map<string, string>,
  extraMovies: Map<string, string>
): Promise<Map<string, TitleInfo>> {
  const out = new Map<string, TitleInfo>();
  const ids = [...seriesNames.keys(), ...extraMovies.keys()];
  const items = ids.length
    ? await itemsByIds(userId, ids, { Fields: "Genres,ProviderIds,ProductionYear", EnableImages: "false" })
    : [];
  for (const it of items) {
    if (it.Type === "Series") {
      out.set(it.Id, {
        id: it.Id,
        kind: "series",
        name: it.Name ?? seriesNames.get(it.Id) ?? "",
        year: it.ProductionYear ?? null,
        tmdbId: tmdbIdOf(it),
        genreIds: genreIdsFromNames(it.Genres ?? []),
        origin: null,
        originalLanguage: null,
        anime: isAnimeJellyfin(it),
        directors: [],
        cast: [],
      });
    } else if (it.Type === "Movie") {
      out.set(it.Id, movieInfo(it));
    }
  }
  const bare = (id: string, kind: "movie" | "series", name: string): TitleInfo => ({
    id, kind, name, year: null, tmdbId: null, genreIds: [], origin: null, originalLanguage: null, anime: false, directors: [], cast: [],
  });
  for (const [id, name] of seriesNames) if (!out.has(id)) out.set(id, bare(id, "series", name));
  for (const [id, name] of extraMovies) if (!out.has(id)) out.set(id, bare(id, "movie", name));
  return out;
}

/**
 * Les étiquettes d'images des titres AFFICHÉS seulement (quelques dizaines) :
 * les demander pour tout l'historique triplerait la taille des parcours.
 */
export async function decorateTitles(userId: string, titles: ViewingStatsTitle[]): Promise<void> {
  const ids = [...new Set(titles.map((t) => t.id))];
  if (ids.length === 0) return;
  const items = await itemsByIds(userId, ids, {
    EnableImages: "true",
    EnableImageTypes: "Primary,Backdrop",
    ImageTypeLimit: "1",
  });
  const tags = new Map(items.map((it) => [it.Id, { primary: it.ImageTags?.Primary ?? null, backdrop: it.BackdropImageTags?.[0] ?? null }]));
  for (const t of titles) {
    const found = tags.get(t.id);
    if (!found) continue;
    t.primaryTag = found.primary;
    t.backdropTag = found.backdrop;
  }
}
