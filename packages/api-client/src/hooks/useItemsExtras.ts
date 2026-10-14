import { useQueries } from "@tanstack/react-query";
import { localExtrasToFetch, type MediaItem } from "@tentacle-tv/shared";
import { useJellyfinClient } from "./useJellyfinClient";
import { useUserId } from "./useUserId";
import type { ExtrasOwner } from "./useItemExtras";

const STALE_MS = 5 * 60 * 1000;
const NONE: MediaItem[] = [];

/**
 * Les extras LOCAUX de PLUSIEURS titres réunis dans UN carrousel — une série
 * et ses saisons, un épisode et sa saison —, dans l'ordre des titres, chacun
 * ses bandes-annonces puis ses bonus, sans doublon. Mêmes clés que
 * `useLocalTrailers` et `useSpecialFeatures` (réponses partagées), et les
 * compteurs évitent toute liste qu'on sait vide (`localExtrasToFetch`).
 */
export function useItemsExtras(owners: readonly ExtrasOwner[]): {
  local: MediaItem[];
  /** L'identifiant du titre (série, saison…) d'où vient chaque extra. */
  ownerOf: ReadonlyMap<string, string>;
  settled: boolean;
} {
  const client = useJellyfinClient();
  const userId = useUserId();
  const wanted = owners.flatMap((owner) => {
    const fetch = localExtrasToFetch(owner);
    return [
      ...(fetch.trailers ? [{ kind: "local-trailers" as const, id: owner.Id }] : []),
      ...(fetch.features ? [{ kind: "special-features" as const, id: owner.Id }] : []),
    ];
  });
  const results = useQueries({
    queries: wanted.map(({ kind, id }) => ({
      queryKey: [kind, id],
      queryFn: () => client.fetch<MediaItem[]>(`/Users/${userId}/Items/${id}/${kind === "local-trailers" ? "LocalTrailers" : "SpecialFeatures"}`),
      enabled: !!userId,
      staleTime: STALE_MS,
    })),
  });
  const settled = results.every((result) => result.isSuccess || result.isError);
  // Recalculé à chaque rendu (quelques extras) : `useQueries` rend un tableau neuf à chaque fois.
  const seen = new Set<string>();
  const local: MediaItem[] = [];
  const ownerOf = new Map<string, string>();
  results.forEach((result, index) => {
    for (const item of result.data ?? NONE) {
      if (seen.has(item.Id)) continue;
      seen.add(item.Id);
      local.push(item);
      ownerOf.set(item.Id, wanted[index].id);
    }
  });
  return { local, ownerOf, settled };
}
