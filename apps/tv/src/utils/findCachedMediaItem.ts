import type { QueryClient } from "@tanstack/react-query";
import type { MediaItem } from "@tentacle-tv/shared";

const looksLikeItem = (v: unknown, id: string): v is MediaItem =>
  !!v && typeof v === "object"
  && (v as MediaItem).Id === id
  && typeof (v as MediaItem).Name === "string";

/** Le titre dans les données d'UNE requête : fiche, liste, pages d'une liste infinie. */
function findInData(data: unknown, itemId: string, accept?: (item: MediaItem) => boolean): MediaItem | null {
  const ok = (v: unknown): v is MediaItem => looksLikeItem(v, itemId) && (!accept || accept(v));
  if (ok(data)) return data;
  const lists: unknown[][] = [];
  if (Array.isArray(data)) {
    lists.push(data);
  } else if (typeof data === "object" && data) {
    const obj = data as { Items?: unknown[]; pages?: { Items?: unknown[] }[] };
    if (Array.isArray(obj.Items)) lists.push(obj.Items);
    if (Array.isArray(obj.pages)) {
      for (const page of obj.pages) if (Array.isArray(page?.Items)) lists.push(page.Items);
    }
  }
  for (const list of lists) {
    for (const it of list) if (ok(it)) return it;
  }
  return null;
}

/**
 * Cherche un MediaItem dans TOUT le cache React Query (listes Home, fiches,
 * épisodes, catalogues — y compris infinite queries) et rend la version la
 * plus FRAÎCHE : un titre vit dans plusieurs rangées, et la reprise d'une
 * rangée vieille de plusieurs minutes trompait (mesuré : 13:01 dans le héros
 * de l'accueil, 1:23 dans « Reprendre »). `accept` écarte les versions qui ne
 * conviennent pas (une carte sans source, pour la lecture).
 *
 * Sert de placeholder à l'écran de chargement du player (titre + affiche
 * immédiats), et de fiche de lecture quand Tentacle ne répond plus
 * (`usePlayerItem`).
 */
export function findCachedMediaItem(
  queryClient: QueryClient,
  itemId: string,
  accept?: (item: MediaItem) => boolean,
): MediaItem | null {
  let best: MediaItem | null = null;
  let bestAt = -1;
  for (const query of queryClient.getQueryCache().getAll()) {
    const data = query.state.data as unknown;
    if (!data || query.state.dataUpdatedAt <= bestAt) continue;
    const found = findInData(data, itemId, accept);
    if (found) {
      best = found;
      bestAt = query.state.dataUpdatedAt;
    }
  }
  return best;
}
