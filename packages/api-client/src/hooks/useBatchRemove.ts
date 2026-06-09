import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useJellyfinClient } from "./useJellyfinClient";
import { useUserId } from "./useUserId";
import { invalidateAllMediaQueries } from "./cacheUtils";

export function useBatchRemoveFavorites() {
  const client = useJellyfinClient();
  const userId = useUserId();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (ids: string[]) =>
      Promise.allSettled(
        ids.map((id) =>
          client.fetch(`/Users/${userId}/FavoriteItems/${id}`, { method: "DELETE" })
        )
      ),
    onSettled: () => invalidateAllMediaQueries(qc),
  });
}

export function useBatchRemoveWatchlist() {
  const client = useJellyfinClient();
  const userId = useUserId();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (ids: string[]) =>
      Promise.allSettled(
        ids.map((id) =>
          client.fetch(`/Users/${userId}/Items/${id}/Rating`, { method: "DELETE" })
        )
      ),
    onSettled: () => invalidateAllMediaQueries(qc),
  });
}
