import type { MediaItem } from "../types/media";
import type { ViewingStats } from "../types/viewingStats";

/**
 * Le titre qui prête son image à la bannière des statistiques : le plus
 * regardé de la période parmi ceux qui ont une image large, en forme d'item
 * Jellyfin minimal — ce que les bannières de collection savent afficher.
 */
export function statsFeaturedItems(stats: ViewingStats | undefined): MediaItem[] | undefined {
  if (!stats) return undefined;
  const best = [...stats.topSeries, ...stats.movies]
    .filter((t) => t.backdropTag)
    .sort((a, b) => b.seconds - a.seconds)[0];
  if (!best?.backdropTag) return undefined;
  return [{ Id: best.id, Name: best.name, Type: best.kind === "series" ? "Series" : "Movie", BackdropImageTags: [best.backdropTag] }];
}
