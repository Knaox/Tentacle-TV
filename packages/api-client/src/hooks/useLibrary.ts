import { useQuery } from "@tanstack/react-query";
import type { LibraryView, MediaItem } from "@tentacle-tv/shared";
import { useJellyfinClient } from "./useJellyfinClient";
import { useUserId } from "./useUserId";

export function useLibraries(options?: { enabled?: boolean }) {
  const client = useJellyfinClient();
  const userId = useUserId();

  return useQuery({
    queryKey: ["libraries"],
    queryFn: async () => {
      const { Items: libraries } = await client.fetch<{ Items: LibraryView[] }>(
        `/Users/${userId}/Views`
      );

      // Récupérer le décompte réel + un item aléatoire par bibliothèque (en parallèle)
      const enriched = await Promise.all(
        libraries.map(async (lib) => {
          const [countRes, randomRes] = await Promise.all([
            client
              .fetch<{ TotalRecordCount: number }>(
                `/Users/${userId}/Items?ParentId=${lib.Id}` +
                  `&IncludeItemTypes=Movie,Series&Recursive=true&ExcludeLocationTypes=Virtual&IsMissing=false` +
                  `&Limit=0&EnableTotalRecordCount=true`
              )
              .catch(() => undefined),
            client
              .fetch<{ Items: Array<{ Id: string; BackdropImageTags?: string[]; ImageTags?: { Primary?: string } }> }>(
                `/Users/${userId}/Items?ParentId=${lib.Id}` +
                  `&IncludeItemTypes=Movie,Series&Recursive=true&ExcludeLocationTypes=Virtual&IsMissing=false` +
                  `&SortBy=Random&Limit=5&EnableImageTypes=Primary,Backdrop&ImageTypeLimit=1`
              )
              .catch(() => undefined),
          ]);

          const randomItems = (randomRes?.Items ?? []).map((item) => ({
            id: item.Id,
            hasBackdrop: (item.BackdropImageTags?.length ?? 0) > 0,
            hasPrimary: !!item.ImageTags?.Primary,
          }));

          return {
            ...lib,
            RecursiveItemCount: countRes?.TotalRecordCount ?? lib.ChildCount,
            _randomItems: randomItems,
          };
        })
      );

      return enriched;
    },
    enabled: !!userId && (options?.enabled ?? true),
    staleTime: 5 * 60 * 1000,
  });
}

export function useLibraryItems(
  libraryId: string | undefined,
  options?: { search?: string; limit?: number; sortBy?: string; sortOrder?: string }
) {
  const client = useJellyfinClient();
  const userId = useUserId();
  const limit = options?.limit ?? 50;
  const sortBy = options?.sortBy ?? "SortName";
  const sortOrder = options?.sortOrder ?? "Ascending";
  const search = options?.search?.trim() ?? "";

  return useQuery({
    queryKey: ["library", libraryId, "items", search, limit, sortBy, sortOrder],
    queryFn: () => {
      let url = `/Users/${userId}/Items?ParentId=${libraryId}` +
        `&SortBy=${sortBy}&SortOrder=${sortOrder}&IncludeItemTypes=Movie,Series` +
        `&Recursive=true&Fields=Overview,PrimaryImageAspectRatio,RecursiveItemCount,MediaSources` +
        `&ExcludeLocationTypes=Virtual&IsMissing=false&Limit=${limit}` +
        `&EnableImageTypes=Primary,Backdrop&ImageTypeLimit=1&EnableUserData=true`;
      if (search.length >= 2) url += `&searchTerm=${encodeURIComponent(search)}`;
      return client.fetch<{ Items: MediaItem[] }>(url).then((r) =>
        r.Items.filter((item) => item.Type !== "Series" || (item.RecursiveItemCount ?? 0) > 0)
      );
    },
    enabled: !!userId && !!libraryId,
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Un item ALÉATOIRE de la bibliothèque possédant un backdrop — pour l'image de
 * la bannière de bibliothèque.
 *
 * `SortBy=Random` + `HasBackdrop=true` + `Limit=1` : le serveur tire l'item, on
 * n'a pas à filtrer côté client. Le tirage est gardé toute la SESSION
 * (`staleTime`/`gcTime: Infinity`) : une seule requête par bibliothèque, quels
 * que soient les allers-venues, et l'image (déjà en cache navigateur) ne se
 * recharge pas. Elle change au prochain lancement de l'app, quand le cache
 * mémoire est reparti de zéro — assez de variété sans un appel réseau à chaque
 * visite. Renvoie `MediaItem | undefined`.
 */
export function useRandomLibraryBackdrop(libraryId: string | undefined) {
  const client = useJellyfinClient();
  const userId = useUserId();

  return useQuery({
    queryKey: ["library", libraryId, "random-backdrop"],
    queryFn: () =>
      client
        .fetch<{ Items: MediaItem[] }>(
          `/Users/${userId}/Items?ParentId=${libraryId}` +
            `&IncludeItemTypes=Movie,Series&Recursive=true&ExcludeLocationTypes=Virtual&IsMissing=false` +
            `&HasBackdrop=true&SortBy=Random&Limit=1` +
            `&Fields=Overview,PrimaryImageAspectRatio&EnableImageTypes=Primary,Backdrop&ImageTypeLimit=1`
        )
        .then((r) => r.Items[0]),
    enabled: !!userId && !!libraryId,
    /* Longtemps, mais pas éternellement. Le tirage est volontairement stable —
     * changer de fond à chaque visite serait agité — seulement, `Infinity` des
     * deux côtés gravait AUSSI les échecs : une bibliothèque interrogée pendant
     * une coupure, ou dont le fond n'était pas encore récupéré, restait sans
     * bannière pour toute la session, sans qu'aucune navigation n'y change quoi
     * que ce soit. Une heure garde la stabilité et laisse une seconde chance. */
    staleTime: 60 * 60 * 1000,
    gcTime: 2 * 60 * 60 * 1000,
  });
}

export function useSeasons(seriesId: string | undefined) {
  const client = useJellyfinClient();
  const userId = useUserId();

  return useQuery({
    queryKey: ["seasons", seriesId],
    queryFn: () =>
      client
        .fetch<{ Items: MediaItem[] }>(
          `/Shows/${seriesId}/Seasons?userId=${userId}&Fields=PrimaryImageAspectRatio,RemoteTrailers`
        )
        .then((r) => r.Items),
    enabled: !!userId && !!seriesId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useEpisodes(seriesId: string | undefined, seasonId: string | undefined) {
  const client = useJellyfinClient();
  const userId = useUserId();

  return useQuery({
    queryKey: ["episodes", seriesId, seasonId],
    queryFn: () =>
      client
        .fetch<{ Items: MediaItem[] }>(
          `/Shows/${seriesId}/Episodes?SeasonId=${seasonId}&userId=${userId}` +
            `&Fields=Overview,PrimaryImageAspectRatio,MediaSources,MediaStreams&EnableUserData=true`
        )
        .then((r) => r.Items),
    enabled: !!userId && !!seriesId && !!seasonId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useMediaItem(itemId: string | undefined, options?: { enabled?: boolean }) {
  const client = useJellyfinClient();
  const userId = useUserId();

  return useQuery({
    queryKey: ["item", itemId],
    queryFn: () =>
      client.fetch<MediaItem>(
        `/Users/${userId}/Items/${itemId}?Fields=Overview,Genres,Taglines,MediaSources,MediaStreams,People,Studios,ProviderIds,Chapters,ParentId,Trickplay,RemoteTrailers,SeriesId,SeasonId,Status&EnableUserData=true`
      ),
    enabled: !!userId && !!itemId && (options?.enabled ?? true),
    staleTime: 5 * 60 * 1000,
  });
}

/** Fetch all ancestors of an item — used to find which library it belongs to. */
export function useItemAncestors(itemId: string | undefined, options?: { enabled?: boolean }) {
  const client = useJellyfinClient();
  const userId = useUserId();

  return useQuery({
    queryKey: ["item-ancestors", itemId],
    queryFn: () =>
      client.fetch<Array<{ Id: string; Name: string; Type: string }>>(
        `/Items/${itemId}/Ancestors?userId=${userId}`
      ),
    enabled: !!userId && !!itemId && (options?.enabled ?? true),
    staleTime: 30 * 60 * 1000,
  });
}

export function useSimilarItems(itemId: string | undefined, parentId?: string) {
  const client = useJellyfinClient();
  const userId = useUserId();

  return useQuery({
    queryKey: ["similar", itemId],
    queryFn: () =>
      client
        .fetch<{ Items: MediaItem[] }>(
          `/Items/${itemId}/Similar?userId=${userId}&Limit=24&Fields=Overview,PrimaryImageAspectRatio,ParentId,MediaSources` +
            `&EnableImageTypes=Primary,Backdrop&ImageTypeLimit=1&EnableUserData=true`
        )
        .then((r) => r.Items),
    select: (items) => {
      if (!parentId) return items.slice(0, 12);
      const sameLib = items.filter((i) => i.ParentId === parentId);
      return (sameLib.length > 0 ? sameLib : items).slice(0, 12);
    },
    enabled: !!userId && !!itemId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Contenu d'une collection (BoxSet) — films/séries enfants, triés par titre.
 * Utilisé par la fiche détail (web + TV) pour rendre les collections
 * navigables (un BoxSet n'a ni MediaSources ni saisons).
 */
export function useCollectionItems(boxSetId: string | undefined) {
  const client = useJellyfinClient();
  const userId = useUserId();

  return useQuery({
    queryKey: ["collection-items", boxSetId],
    queryFn: () =>
      client
        .fetch<{ Items: MediaItem[] }>(
          `/Users/${userId}/Items?ParentId=${boxSetId}&SortBy=PremiereDate,SortName&SortOrder=Ascending` +
            `&Fields=Overview,PrimaryImageAspectRatio,MediaSources` +
            `&EnableImageTypes=Primary,Backdrop&ImageTypeLimit=1&EnableUserData=true`
        )
        .then((r) => r.Items),
    enabled: !!userId && !!boxSetId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useGenres(libraryId: string | undefined) {
  const client = useJellyfinClient();
  const userId = useUserId();

  return useQuery({
    queryKey: ["genres", libraryId],
    queryFn: () =>
      client
        .fetch<{ Items: Array<{ Id: string; Name: string }> }>(
          `/Genres?ParentId=${libraryId}&UserId=${userId}&Fields=PrimaryImageAspectRatio`
        )
        .then((r) => r.Items),
    enabled: !!userId && !!libraryId,
    staleTime: 10 * 60 * 1000,
  });
}

export function useStudios(libraryId: string | undefined) {
  const client = useJellyfinClient();
  const userId = useUserId();

  return useQuery({
    queryKey: ["studios", libraryId],
    queryFn: () =>
      client
        .fetch<{ Items: Array<{ Id: string; Name: string }> }>(
          `/Studios?ParentId=${libraryId}&UserId=${userId}`
        )
        .then((r) => r.Items),
    enabled: !!userId && !!libraryId,
    staleTime: 10 * 60 * 1000,
  });
}

// Le catalogue paginé (CatalogFilters, useLibraryCatalog, prefetch) vit dans
// useLibraryCatalog.ts — extraction pour la limite de 300 lignes par fichier.
