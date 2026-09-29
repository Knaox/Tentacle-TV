import { useQuery } from "@tanstack/react-query";
import type { MediaItem } from "@tentacle-tv/shared";
import { JellyfinError } from "../jellyfin/types";
import { useJellyfinClient } from "./useJellyfinClient";
import { useUserId } from "./useUserId";

/** La route « Fait partie de » (Jellyfin 12.0+). */
export function includedInPath(itemId: string, userId: string): string {
  return `/Items/${itemId}/Collections?userId=${userId}&Fields=PrimaryImageAspectRatio&EnableImageTypes=Primary,Backdrop&ImageTypeLimit=1`;
}

/**
 * Les collections qui contiennent un titre (« Fait partie de »). Capacité de
 * Jellyfin 12.0 : un serveur plus ancien répond 404 — la liste est alors vide
 * et la rangée ne s'affiche pas, sans erreur.
 */
export function useIncludedInCollections(itemId: string | undefined) {
  const client = useJellyfinClient();
  const userId = useUserId();
  return useQuery<MediaItem[]>({
    queryKey: ["item", itemId, "included-in"],
    queryFn: async () => {
      try {
        const res = await client.fetch<{ Items?: MediaItem[] } | MediaItem[]>(includedInPath(itemId ?? "", userId ?? ""));
        return Array.isArray(res) ? res : res.Items ?? [];
      } catch (err) {
        // 404 : route absente (avant 12.0) ; 403 : proxy d'un serveur Tentacle
        // qui ne la laisse pas encore passer. Dans les deux cas, rien à montrer.
        if (err instanceof JellyfinError && (err.status === 404 || err.status === 403)) return [];
        throw err;
      }
    },
    enabled: !!itemId && !!userId,
    staleTime: 10 * 60_000,
  });
}
