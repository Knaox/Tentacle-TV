import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useJellyfinClient } from "./useJellyfinClient";
import { useUserId } from "./useUserId";
import { invalidateAllMediaQueries } from "./cacheUtils";
import { forgetAutoRetired } from "./watchlistAutoRetired";

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
    // Retrait manuel : les suivis de retour automatique n'ont plus lieu d'être
    // (un id de film ne correspond à aucun suivi — l'appel est sans effet).
    onSuccess: (_result, ids) => {
      for (const id of ids) void forgetAutoRetired(id);
    },
    onSettled: () => invalidateAllMediaQueries(qc),
  });
}
