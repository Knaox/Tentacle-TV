import type { QueryClient } from "@tanstack/react-query";
import type { MediaItem } from "@tentacle-tv/shared";

const looksLikeItem = (v: unknown, id: string): v is MediaItem =>
  !!v && typeof v === "object"
  && (v as MediaItem).Id === id
  && typeof (v as MediaItem).Name === "string";

/**
 * Cherche un MediaItem dans TOUT le cache React Query (listes Home, fiches,
 * épisodes, catalogues — y compris infinite queries). Sert de placeholder
 * pour l'écran de chargement du player pendant le fetch de l'item complet :
 * titre + affiche s'affichent immédiatement au lieu d'un écran noir.
 */
export function findCachedMediaItem(queryClient: QueryClient, itemId: string): MediaItem | null {
  for (const query of queryClient.getQueryCache().getAll()) {
    const data = query.state.data as unknown;
    if (!data) continue;
    if (looksLikeItem(data, itemId)) return data;
    const lists: unknown[][] = [];
    if (Array.isArray(data)) {
      lists.push(data);
    } else if (typeof data === "object") {
      const obj = data as { Items?: unknown[]; pages?: { Items?: unknown[] }[] };
      if (Array.isArray(obj.Items)) lists.push(obj.Items);
      if (Array.isArray(obj.pages)) {
        for (const page of obj.pages) if (Array.isArray(page?.Items)) lists.push(page.Items);
      }
    }
    for (const list of lists) {
      for (const it of list) if (looksLikeItem(it, itemId)) return it;
    }
  }
  return null;
}
