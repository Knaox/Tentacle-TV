import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useJellyfinClient } from "./useJellyfinClient";
import { useUserId } from "./useUserId";
import { invalidateAllMediaQueries, updateItemUserDataInCache, restoreFromSnapshot } from "./cacheUtils";

export function useFavorite(itemId: string | undefined) {
  const client = useJellyfinClient();
  const userId = useUserId();
  const qc = useQueryClient();

  const add = useMutation({
    mutationFn: () => client.fetch(`/Users/${userId}/FavoriteItems/${itemId}`, { method: "POST" }),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ["item", itemId] });
      const snapshot = updateItemUserDataInCache(qc, itemId!, () => ({ IsFavorite: true }));
      return { snapshot };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.snapshot) restoreFromSnapshot(qc, ctx.snapshot);
    },
    onSettled: () => invalidateAllMediaQueries(qc, { itemId }),
  });

  const remove = useMutation({
    mutationFn: () => client.fetch(`/Users/${userId}/FavoriteItems/${itemId}`, { method: "DELETE" }),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ["item", itemId] });
      const snapshot = updateItemUserDataInCache(qc, itemId!, () => ({ IsFavorite: false }));
      return { snapshot };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.snapshot) restoreFromSnapshot(qc, ctx.snapshot);
    },
    onSettled: () => invalidateAllMediaQueries(qc, { itemId }),
  });

  return { add, remove };
}
