import { useQuery } from "@tanstack/react-query";
import type { MediaItem } from "@tentacle-tv/shared";
import { useJellyfinClient } from "./useJellyfinClient";
import { useUserId } from "./useUserId";
import { groupLatestByRuns } from "../utils/mediaFilters";
import { EPISODE_FIELDS, FIELDS, IMAGE_OPTS, USER_DATA } from "./homeQueryParams";
import { homeLimits, staleFactor } from "../net/dataSaver";

// « Derniers ajouts » d'une bibliothèque — sortis de `useHome.ts`, qui
// dépassait les 300 lignes. Comportement inchangé.

interface LatestItemsOptions {
  /** CollectionType de la bibliothèque (ex: "tvshows", "movies"). Quand "tvshows",
   *  la rangée demande des épisodes : un serveur récent les rend déjà regroupés,
   *  une carte par série (proxy, `latestAdditions`) ; face à un serveur plus
   *  ancien, ils sont regroupés ici par runs consécutifs (cf. groupLatestByRuns). */
  collectionType?: string;
  /** Différer la requête jusqu'à ce que la rangée approche du viewport
   *  (mode économie). Par défaut la rangée charge dès le montage. */
  enabled?: boolean;
}

/**
 * Les cartes d'une rangée « Derniers ajouts » : vingt au plus — une fois les
 * épisodes regroupés par série, seize laissaient la rangée trop vide (demandé
 * par l'utilisateur le 2026-10-02). Le serveur en rend autant.
 */
export const LATEST_ROW_CARDS = 20;

/** Stable : `select` recalcule à chaque nouvelle identité de fonction. */
const selectLatestRow = (items: MediaItem[]): MediaItem[] => groupLatestByRuns(items, LATEST_ROW_CARDS);

// Fenêtre d'épisodes récupérée avant regroupement par série : cf.
// `homeLimits().latestEpisodes`. Assez large pour qu'une saison ajoutée en
// masse n'éjecte pas les séries précédentes, mais bornée — 200 → 100 divisait
// le payload par 2 sans perte visible (la rangée n'affiche qu'une vingtaine de
// groupes), et le mode économie descend à 40.

/**
 * Les options de la requête des « Derniers ajouts » d'une bibliothèque — la
 * même clé, la même requête et le même regroupement que `useLatestItems`,
 * pour qui charge TOUTES les bibliothèques d'un coup (`useQueries`) : le
 * téléviseur refondu rend l'accueil en une seule vue, pas en une rangée par
 * composant. Un seul cache pour les deux.
 */
export function latestItemsQueryOptions(
  client: ReturnType<typeof useJellyfinClient>,
  userId: string | null,
  parentId: string | undefined,
  options?: LatestItemsOptions,
) {
  const episodeMode = options?.collectionType === "tvshows";
  return {
    // Le 3e segment évite qu'un cache "série groupée" serve un consommateur "épisodes".
    queryKey: ["latest-items", parentId, episodeMode ? "episodes" : "default"] as const,
    queryFn: () => {
      if (!parentId || !userId) return Promise.resolve([]);
      if (episodeMode) {
        // Épisodes triés par date d'ajout, SANS filtre "non lu" (un épisode vu
        // reste présent). Large fenêtre car on regroupe ensuite par runs.
        return client
          .fetch<{ Items: MediaItem[] }>(
            `/Users/${userId}/Items?ParentId=${parentId}&Recursive=true&IncludeItemTypes=Episode` +
              `&SortBy=DateCreated&SortOrder=Descending&Limit=${homeLimits().latestEpisodes}` +
              `&Fields=${EPISODE_FIELDS}&${IMAGE_OPTS}&${USER_DATA}`
          )
          .then((r) => r.Items);
      }
      // Films (ou autres) : derniers ajoutés par date, SANS filtre "non lu".
      const typeFilter = options?.collectionType === "movies" ? "&IncludeItemTypes=Movie" : "";
      return client
        .fetch<{ Items: MediaItem[] }>(
          `/Users/${userId}/Items?ParentId=${parentId}&Recursive=true${typeFilter}` +
            `&SortBy=DateCreated&SortOrder=Descending&Limit=${LATEST_ROW_CARDS}` +
            `&Fields=${FIELDS}&${IMAGE_OPTS}&${USER_DATA}`
        )
        .then((r) => r.Items);
    },
    select: episodeMode ? selectLatestRow : undefined,
    enabled: !!userId && !!parentId && (options?.enabled ?? true),
    staleTime: 2 * 60 * 1000 * staleFactor(),
  };
}

export function useLatestItems(parentId: string | undefined, options?: LatestItemsOptions) {
  const client = useJellyfinClient();
  const userId = useUserId();
  return useQuery(latestItemsQueryOptions(client, userId, parentId, options));
}
