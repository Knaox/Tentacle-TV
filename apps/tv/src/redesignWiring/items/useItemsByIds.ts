import { useMemo, useRef } from "react";
import { useQueries } from "@tanstack/react-query";
import { useJellyfinClient, useUserId } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";

/**
 * Les items Jellyfin de titres connus par leur identifiant seul — ceux d'une
 * page de recommandations, qui ne porte que `jellyfinItemId`. Une carte
 * refondue a besoin de ce que l'item sait : ses images (et leurs tags), leur
 * empreinte floue (la lumière de l'œuvre), son état de lecture.
 *
 * Par lots de 50, triés, sous une clé stable : la même page redemandée ne
 * refait pas les requêtes, et un titre de plus ne recharge que son lot.
 * Champs minimaux, une image par type.
 */

const CHUNK = 50;
const FIELDS = "ProductionYear,Genres,PrimaryImageAspectRatio,ProviderIds,MediaSources";
const IMAGES = "EnableImageTypes=Primary,Backdrop,Thumb,Logo&ImageTypeLimit=1&EnableUserData=true";

export function useItemsByIds(ids: readonly string[]): ReadonlyMap<string, MediaItem> {
  const client = useJellyfinClient();
  const userId = useUserId();
  const chunks = useMemo(() => {
    const sorted = [...new Set(ids)].sort();
    const out: string[][] = [];
    for (let i = 0; i < sorted.length; i += CHUNK) out.push(sorted.slice(i, i + CHUNK));
    return out;
  }, [ids]);

  const results = useQueries({
    queries: chunks.map((chunk) => ({
      queryKey: ["tv-items-by-ids", chunk.join(",")] as const,
      queryFn: () =>
        client
          .fetch<{ Items: MediaItem[] }>(`/Users/${userId}/Items?Ids=${chunk.join(",")}&Fields=${FIELDS}&${IMAGES}`)
          .then((response) => response.Items ?? []),
      enabled: !!userId && chunk.length > 0,
      staleTime: 5 * 60 * 1000,
    })),
  });

  // Les résultats sont un tableau neuf à chaque rendu : la carte ne se refait
  // que quand un lot a reçu des données.
  const stamp = results.map((result) => `${result.dataUpdatedAt}`).join("|");
  const cache = useRef<{ stamp: string; map: ReadonlyMap<string, MediaItem> }>({ stamp: "", map: new Map() });
  if (cache.current.stamp !== stamp) {
    cache.current = { stamp, map: new Map(results.flatMap((result) => result.data ?? []).map((item) => [item.Id, item])) };
  }
  return cache.current.map;
}
