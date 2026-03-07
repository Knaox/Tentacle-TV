import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useJellyfinClient } from "./useJellyfinClient";
import { useUserId } from "./useUserId";

export function useFavorite(itemId: string | undefined) {
  const client = useJellyfinClient();
  const userId = useUserId();
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["item", itemId] });
  };

  const add = useMutation({
    mutationFn: () => client.fetch(`/Users/${userId}/FavoriteItems/${itemId}`, { method: "POST" }),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: () => client.fetch(`/Users/${userId}/FavoriteItems/${itemId}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  return { add, remove };
}
