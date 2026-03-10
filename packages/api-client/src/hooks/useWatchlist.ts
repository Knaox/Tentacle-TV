import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { MediaItem } from "@tentacle-tv/shared";
import { useJellyfinClient } from "./useJellyfinClient";
import { useUserId } from "./useUserId";

const FIELDS = "Overview,Genres,PrimaryImageAspectRatio";
const IMAGE_OPTS = "EnableImageTypes=Primary,Backdrop,Thumb&ImageTypeLimit=1";

export function useWatchlist() {
  const client = useJellyfinClient();
  const userId = useUserId();

  return useQuery({
    queryKey: ["watchlist"],
    queryFn: () =>
      client
        .fetch<{ Items: MediaItem[] }>(
          `/Users/${userId}/Items?Filters=Likes&Recursive=true` +
            `&IncludeItemTypes=Movie,Series&SortBy=DateCreated&SortOrder=Descending` +
            `&Limit=20&Fields=${FIELDS}&${IMAGE_OPTS}&EnableUserData=true`
        )
        .then((r) => r.Items),
    enabled: !!userId,
    staleTime: 60_000,
  });
}

export function useToggleWatchlist(itemId: string | undefined) {
  const client = useJellyfinClient();
  const userId = useUserId();
  const queryClient = useQueryClient();

  const add = useMutation({
    mutationFn: () =>
      client.fetch(`/Users/${userId}/Items/${itemId}/Rating?likes=true`, { method: "POST" }),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["item", itemId] });
      const prev = queryClient.getQueryData<MediaItem>(["item", itemId]);
      if (prev?.UserData) {
        queryClient.setQueryData<MediaItem>(["item", itemId], {
          ...prev,
          UserData: { ...prev.UserData, Likes: true },
        });
      }
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(["item", itemId], context.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["item", itemId] });
      queryClient.invalidateQueries({ queryKey: ["watchlist"] });
      queryClient.invalidateQueries({ queryKey: ["favorites"] });
      queryClient.invalidateQueries({ queryKey: ["latest-items"] });
      queryClient.invalidateQueries({ queryKey: ["library"] });
    },
  });

  const remove = useMutation({
    mutationFn: () =>
      client.fetch(`/Users/${userId}/Items/${itemId}/Rating`, { method: "DELETE" }),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["item", itemId] });
      const prev = queryClient.getQueryData<MediaItem>(["item", itemId]);
      if (prev?.UserData) {
        queryClient.setQueryData<MediaItem>(["item", itemId], {
          ...prev,
          UserData: { ...prev.UserData, Likes: false },
        });
      }
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(["item", itemId], context.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["item", itemId] });
      queryClient.invalidateQueries({ queryKey: ["watchlist"] });
      queryClient.invalidateQueries({ queryKey: ["favorites"] });
      queryClient.invalidateQueries({ queryKey: ["latest-items"] });
      queryClient.invalidateQueries({ queryKey: ["library"] });
    },
  });

  return { add, remove };
}

export function useFavorites() {
  const client = useJellyfinClient();
  const userId = useUserId();

  return useQuery({
    queryKey: ["favorites"],
    queryFn: () =>
      client
        .fetch<{ Items: MediaItem[] }>(
          `/Users/${userId}/Items?Filters=IsFavorite&Recursive=true` +
            `&IncludeItemTypes=Movie,Series&SortBy=DateCreated&SortOrder=Descending` +
            `&Limit=20&Fields=${FIELDS}&${IMAGE_OPTS}&EnableUserData=true`
        )
        .then((r) => r.Items),
    enabled: !!userId,
    staleTime: 60_000,
  });
}

export function useWatchlistAll() {
  const client = useJellyfinClient();
  const userId = useUserId();

  return useQuery({
    queryKey: ["watchlist", "all"],
    queryFn: () =>
      client
        .fetch<{ Items: MediaItem[] }>(
          `/Users/${userId}/Items?Filters=Likes&Recursive=true` +
            `&IncludeItemTypes=Movie,Series&SortBy=DateCreated&SortOrder=Descending` +
            `&Fields=${FIELDS}&${IMAGE_OPTS}&EnableUserData=true`
        )
        .then((r) => r.Items),
    enabled: !!userId,
    staleTime: 60_000,
  });
}

export function useFavoritesAll() {
  const client = useJellyfinClient();
  const userId = useUserId();

  return useQuery({
    queryKey: ["favorites", "all"],
    queryFn: () =>
      client
        .fetch<{ Items: MediaItem[] }>(
          `/Users/${userId}/Items?Filters=IsFavorite&Recursive=true` +
            `&IncludeItemTypes=Movie,Series&SortBy=DateCreated&SortOrder=Descending` +
            `&Fields=${FIELDS}&${IMAGE_OPTS}&EnableUserData=true`
        )
        .then((r) => r.Items),
    enabled: !!userId,
    staleTime: 60_000,
  });
}
