import { useMemo, useState } from "react";
import type { MediaItem, ViewingStats } from "@tentacle-tv/shared";

/** Le plus regardé de la période qui ait une image large, en forme d'item Jellyfin minimal. */
function pickFeatured(stats: ViewingStats | undefined): MediaItem[] | undefined {
  if (!stats) return undefined;
  const best = [...stats.topSeries, ...stats.movies]
    .filter((t) => t.backdropTag)
    .sort((a, b) => b.seconds - a.seconds)[0];
  if (!best?.backdropTag) return undefined;
  return [{ Id: best.id, Name: best.name, Type: best.kind === "series" ? "Series" : "Movie", BackdropImageTags: [best.backdropTag] }];
}

/**
 * Le titre qui prête son image à la bannière. On garde le dernier trouvé :
 * passer à une période sans visuel ne fait pas disparaître la bannière — la
 * page ne saute pas, elle garde l'image précédente.
 */
export function useFeaturedTitle(stats: ViewingStats | undefined): MediaItem[] | undefined {
  const current = useMemo(() => pickFeatured(stats), [stats]);
  const [kept, setKept] = useState(current);
  if (current && current[0].Id !== kept?.[0]?.Id) setKept(current);
  return current ?? kept;
}
