import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { MediaItem } from "@tentacle-tv/shared";
import { useJellyfinClient } from "./useJellyfinClient";
import { useUserId } from "./useUserId";

export function useFavorite(itemId: string | undefined) {
  const client = useJellyfinClient();
  const userId = useUserId();
  const queryClient = useQueryClient();

  const add = useMutation({
    mutationFn: () => client.fetch(`/Users/${userId}/FavoriteItems/${itemId}`, { method: "POST" }),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["item", itemId] });
      const prev = queryClient.getQueryData<MediaItem>(["item", itemId]);
      if (prev?.UserData) {
        queryClient.setQueryData<MediaItem>(["item", itemId], {
          ...prev,
          UserData: { ...prev.UserData, IsFavorite: true },
        });
      }
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(["item", itemId], context.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["item", itemId] });
      queryClient.invalidateQueries({ queryKey: ["favorites"] });
      queryClient.invalidateQueries({ queryKey: ["latest-items"] });
      queryClient.invalidateQueries({ queryKey: ["watchlist"] });
      queryClient.invalidateQueries({ queryKey: ["library"] });
    },
  });

  const remove = useMutation({
    mutationFn: () => client.fetch(`/Users/${userId}/FavoriteItems/${itemId}`, { method: "DELETE" }),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["item", itemId] });
      const prev = queryClient.getQueryData<MediaItem>(["item", itemId]);
      if (prev?.UserData) {
        queryClient.setQueryData<MediaItem>(["item", itemId], {
          ...prev,
          UserData: { ...prev.UserData, IsFavorite: false },
        });
      }
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(["item", itemId], context.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["item", itemId] });
      queryClient.invalidateQueries({ queryKey: ["favorites"] });
      queryClient.invalidateQueries({ queryKey: ["latest-items"] });
      queryClient.invalidateQueries({ queryKey: ["watchlist"] });
      queryClient.invalidateQueries({ queryKey: ["library"] });
    },
  });

  return { add, remove };
}
