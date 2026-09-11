import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { MediaItem } from "@tentacle-tv/shared";
import { useJellyfinClient } from "./useJellyfinClient";
import { useUserId } from "./useUserId";

export const SERIES_RATINGS_KEY = "series-ratings";

const EMPTY: ReadonlyMap<string, number> = new Map();

/**
 * Les notes globales d'une poignée de séries, en UN SEUL appel.
 *
 * Pourquoi une requête à part plutôt qu'un champ de plus sur ce qui est déjà
 * chargé : la tuile d'un lot « +N » est fabriquée côté client par
 * `groupLatestByRuns`, à partir d'ÉPISODES, et cette fonction est pure — elle
 * tourne dans un `select`, rejoué à chaque lecture du cache, elle ne peut donc
 * rien aller chercher. Et poser une note de série sur les épisodes en amont
 * ferait mentir le DTO : la fiche, l'aperçu au survol et les chips lisent tous
 * `item.CommunityRating` en croyant lire celle de l'item.
 *
 * Le coût, mesuré sur la forme de la réponse : une rangée « Derniers ajouts »
 * rend au plus seize tuiles, donc au plus seize séries distinctes. Images et
 * données utilisateur coupées, c'est environ deux cents octets par série — un
 * centième de la requête d'épisodes que ce hook accompagne, et une seule fois
 * par rangée et par session.
 *
 * ⚠️ `apps/tv` résout TanStack Query v4 au runtime tout en étant typé v5 : ce
 * hook s'en tient au sous-ensemble commun (`queryKey`, `queryFn`, `enabled`,
 * `staleTime`, `select`). Pas de `placeholderData`, pas de `gcTime`.
 */
export function useSeriesRatings(seriesIds: readonly string[]): ReadonlyMap<string, number> {
  const client = useJellyfinClient();
  const userId = useUserId();

  // Triés et dédoublonnés AVANT d'entrer dans la clé : deux rangées qui
  // réclament les mêmes séries dans un autre ordre doivent tomber sur la même
  // entrée de cache, sinon chacune paie sa requête.
  const signature = seriesIds.join(",");
  const ids = useMemo(() => [...new Set(seriesIds)].sort().join(","), [signature]);

  const { data } = useQuery({
    queryKey: [SERIES_RATINGS_KEY, ids],
    queryFn: () =>
      client.fetch<{ Items: MediaItem[] }>(
        // Pas de `Fields` : `CommunityRating` est une propriété de base du DTO,
        // pas une valeur de l'énum `ItemFields` — l'y mettre ne ferait que
        // grossir l'URL. `EnableImages=false` retire en revanche les tags
        // d'affiche et d'arrière-plan, qui font l'essentiel du poids.
        `/Users/${userId}/Items?Ids=${ids}&Limit=${ids.split(",").length}` +
          `&EnableImages=false&EnableUserData=false&EnableTotalRecordCount=false`,
      ),
    enabled: !!userId && ids.length > 0,
    // Une note globale ne bouge pas dans une session.
    staleTime: 10 * 60 * 1000,
    select: (r: { Items: MediaItem[] }) => {
      const map = new Map<string, number>();
      for (const item of r.Items ?? []) {
        const rating = item.CommunityRating;
        if (item.Id && typeof rating === "number" && rating > 0) map.set(item.Id, rating);
      }
      return map as ReadonlyMap<string, number>;
    },
  });

  // Une carte vide GELÉE au niveau module : les rangées qui n'ont rien à
  // résoudre ne paient pas même une allocation par rendu.
  return data ?? EMPTY;
}
