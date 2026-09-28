import { useMemo, useState } from "react";
import { statsFeaturedItems, type MediaItem, type ViewingStats } from "@tentacle-tv/shared";

/**
 * Le titre qui prête son image à l'ambiance de l'écran (`statsFeaturedItems`,
 * shared, comme au web). On garde le dernier trouvé : une période sans visuel
 * ne fait pas tomber l'ambiance.
 */
export function useFeaturedTitle(stats: ViewingStats | undefined): MediaItem[] | undefined {
  const current = useMemo(() => statsFeaturedItems(stats), [stats]);
  const [kept, setKept] = useState(current);
  if (current && current[0].Id !== kept?.[0]?.Id) setKept(current);
  return current ?? kept;
}
