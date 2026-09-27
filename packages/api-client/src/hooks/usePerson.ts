/**
 * La page d'une PERSONNE : sa fiche Jellyfin (photo, biographie, naissance)
 * et ses titres dans la bibliothèque — commun au web, au bureau et au mobile.
 *
 * La filmographie se lit d'abord dans l'index du serveur Tentacle
 * (`/api/search/person/:id`), qui dit ce que la personne a fait sur chaque
 * titre (jouer, réaliser…) et ne rend que ce que le compte voit. L'index n'est
 * prêt qu'une vingtaine de secondes après le démarrage du serveur : en
 * attendant — ou s'il ne connaît pas la personne —, Jellyfin répond seul, sans
 * les rôles. La page s'affiche dans les deux cas.
 *
 * Clé sous le préfixe `search` : un « vu » ou un favori rafraîchit les
 * vignettes comme ailleurs (`cacheUtils.ts`).
 */

import { useQuery } from "@tanstack/react-query";
import type {
  FilmographyEntry, MediaItem, PersonDetails, SearchBrowseResponse, SearchMediaItem,
} from "@tentacle-tv/shared";
import { useJellyfinClient } from "./useJellyfinClient";
import { useUserId } from "./useUserId";
import { tentacleApiFetch } from "./usePreferences";

const PERSON_FIELDS = "Overview,ProviderIds,ProductionLocations,PremiereDate,EndDate,ExternalUrls";

/** La personne telle que Jellyfin la connaît : biographie, naissance, identifiants. */
export function usePersonDetails(personId: string | undefined) {
  const client = useJellyfinClient();
  const userId = useUserId();
  return useQuery({
    queryKey: ["person", personId],
    queryFn: ({ signal }) =>
      client.fetch<PersonDetails>(`/Users/${userId}/Items/${personId}?Fields=${PERSON_FIELDS}`, { signal }),
    enabled: !!userId && !!personId,
    staleTime: 30 * 60_000,
  });
}

export interface PersonFilmography {
  entries: FilmographyEntry<SearchMediaItem>[];
  total: number;
  /** D'où viennent les titres : l'index (avec les rôles) ou Jellyfin seul (sans). */
  source: "index" | "jellyfin";
}

/** Un item Jellyfin réduit à ce qu'une vignette de résultat lit — la forme de l'index. */
function toSearchItem(item: MediaItem): SearchMediaItem | null {
  if (item.Type !== "Movie" && item.Type !== "Series" && item.Type !== "BoxSet") return null;
  return {
    Id: item.Id,
    Name: item.Name,
    Type: item.Type,
    OriginalTitle: item.OriginalTitle,
    ProductionYear: item.ProductionYear,
    EndDate: item.EndDate,
    CommunityRating: item.CommunityRating,
    OfficialRating: item.OfficialRating,
    RunTimeTicks: item.RunTimeTicks,
    Status: item.Status,
    ChildCount: item.ChildCount,
    PrimaryImageAspectRatio: item.PrimaryImageAspectRatio,
    Genres: item.Genres,
    ImageTags: item.ImageTags,
    BackdropImageTags: item.BackdropImageTags,
    UserData: item.UserData,
  };
}

function isAbort(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

/** Les titres de la bibliothèque où figure la personne, du plus récent au plus ancien. */
export function usePersonFilmography(personId: string | undefined, limit = 200) {
  const client = useJellyfinClient();
  const userId = useUserId();
  return useQuery({
    queryKey: ["search", "person-filmography", personId, limit],
    queryFn: async ({ signal }): Promise<PersonFilmography> => {
      try {
        const res = await tentacleApiFetch<SearchBrowseResponse>(
          `/api/search/person/${encodeURIComponent(personId as string)}?limit=${limit}`,
          { signal },
        );
        return {
          entries: res.items.map((hit) => ({ item: hit.item, role: hit.match.role ?? null })),
          total: res.total,
          source: "index",
        };
      } catch (error) {
        if (isAbort(error)) throw error;
        const res = await client.fetch<{ Items: MediaItem[]; TotalRecordCount?: number }>(
          `/Users/${userId}/Items?PersonIds=${personId}&Recursive=true&IncludeItemTypes=Movie,Series` +
            `&SortBy=ProductionYear,SortName&SortOrder=Descending&Limit=${limit}` +
            `&Fields=PrimaryImageAspectRatio,Genres&EnableImageTypes=Primary,Backdrop&ImageTypeLimit=1&EnableUserData=true`,
          { signal },
        );
        const entries = res.Items
          .map(toSearchItem)
          .filter((item): item is SearchMediaItem => item !== null)
          .map((item) => ({ item, role: null }));
        return { entries, total: res.TotalRecordCount ?? entries.length, source: "jellyfin" };
      }
    },
    enabled: !!userId && !!personId,
    staleTime: 5 * 60_000,
  });
}
