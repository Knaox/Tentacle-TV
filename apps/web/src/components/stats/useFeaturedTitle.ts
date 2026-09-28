import { useMemo, useState } from "react";
import { statsFeaturedItems, type MediaItem, type ViewingStats } from "@tentacle-tv/shared";

/**
 * Le titre qui prête son image à la bannière (`statsFeaturedItems`, shared).
 * On garde le dernier trouvé : passer à une période sans visuel ne fait pas
 * disparaître la bannière — la page ne saute pas, elle garde l'image
 * précédente.
 */
export function useFeaturedTitle(stats: ViewingStats | undefined): MediaItem[] | undefined {
  const current = useMemo(() => statsFeaturedItems(stats), [stats]);
  const [kept, setKept] = useState(current);
  if (current && current[0].Id !== kept?.[0]?.Id) setKept(current);
  return current ?? kept;
}
