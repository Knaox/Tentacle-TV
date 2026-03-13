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

function getAuthHeader(): Record<string, string> {
  const token = typeof localStorage !== "undefined"
    ? localStorage.getItem("tentacle_token")
    : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function useBatchRemoveSharedItems(watchlistId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (itemIds: string[]) => {
      const headers = getAuthHeader();
      const hasToken = !!localStorage.getItem("tentacle_token");
      return Promise.allSettled(
        itemIds.map((id) =>
          fetch(`/api/shared-watchlists/${watchlistId}/items/${id}`, {
            method: "DELETE",
            headers,
            credentials: hasToken ? undefined : "include",
          }).then((r) => {
            if (!r.ok) throw new Error(`${r.status}`);
          })
        )
      );
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["sw", "items", watchlistId] });
      qc.invalidateQueries({ queryKey: ["sw", "lists"] });
    },
  });
}
