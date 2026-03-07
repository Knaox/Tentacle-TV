import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useJellyfinClient } from "./useJellyfinClient";
import { useUserId } from "./useUserId";

export function useWatchedToggle(itemId: string | undefined) {
  const client = useJellyfinClient();
  const userId = useUserId();
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["item", itemId] });
  };

  const markWatched = useMutation({
    mutationFn: () => client.fetch(`/Users/${userId}/PlayedItems/${itemId}`, { method: "POST" }),
    onSuccess: invalidate,
  });

  const markUnwatched = useMutation({
    mutationFn: () => client.fetch(`/Users/${userId}/PlayedItems/${itemId}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  return { markWatched, markUnwatched };
}
