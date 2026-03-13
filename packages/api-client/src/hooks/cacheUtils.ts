import type { QueryClient, InfiniteData } from "@tanstack/react-query";
import type { MediaItem, UserItemData } from "@tentacle-tv/shared";

/**
 * Préfixes de query keys contenant des listes de MediaItem avec UserData.
 * TanStack Query ne refetch que les queries avec observers actifs → pas d'impact perf.
 */
const LIST_QUERY_PREFIXES = [
  "favorites",
  "watchlist",
  "latest-items",
  "resume-items",
  "next-up",
  "watched-items",
  "featured",
  "continue-watching",
  "library",
  "episodes",
  "search",
  "similar",
  "seasons",
  "series-watch-state",
] as const;

interface InvalidateOptions {
  itemId?: string;
  seriesContext?: { seriesId: string; seasonId?: string };
}

/**
 * Invalide toutes les query keys qui affichent des MediaItem avec UserData.
 */
export function invalidateAllMediaQueries(
  qc: QueryClient,
  opts?: InvalidateOptions,
): void {
  for (const prefix of LIST_QUERY_PREFIXES) {
    qc.invalidateQueries({ queryKey: [prefix] });
  }

  if (opts?.itemId) {
    qc.invalidateQueries({ queryKey: ["item", opts.itemId] });
  }

  if (opts?.seriesContext) {
    qc.invalidateQueries({ queryKey: ["item", opts.seriesContext.seriesId] });
  }
}

type UserDataUpdater = (prev: UserItemData) => Partial<UserItemData>;

/**
 * Propage une mise à jour optimiste de UserData dans toutes les queries en cache.
 * Retourne un snapshot pour rollback.
 */
export function updateItemUserDataInCache(
  qc: QueryClient,
  itemId: string,
  updater: UserDataUpdater,
): Map<string, unknown> {
  const snapshot = new Map<string, unknown>();

  // 1. Mise à jour directe sur ["item", itemId]
  const itemKey = JSON.stringify(["item", itemId]);
  const itemData = qc.getQueryData<MediaItem>(["item", itemId]);
  if (itemData) {
    snapshot.set(itemKey, itemData);
    if (itemData.UserData) {
      qc.setQueryData<MediaItem>(["item", itemId], {
        ...itemData,
        UserData: { ...itemData.UserData, ...updater(itemData.UserData) },
      });
    }
  }

  // 2. Parcourir toutes les queries en cache
  const allQueries = qc.getQueryCache().findAll();

  for (const query of allQueries) {
    const key = query.queryKey;
    const keyStr = JSON.stringify(key);

    // Skip si déjà traité
    if (keyStr === itemKey) continue;

    // Vérifier si c'est une query de liste connue
    const prefix = key[0];
    if (typeof prefix !== "string" || !LIST_QUERY_PREFIXES.includes(prefix as typeof LIST_QUERY_PREFIXES[number])) {
      continue;
    }

    const data = query.state.data;
    if (!data) continue;

    // Listes flat (MediaItem[])
    if (Array.isArray(data)) {
      const idx = (data as MediaItem[]).findIndex((item) => item.Id === itemId);
      if (idx !== -1) {
        const item = (data as MediaItem[])[idx];
        if (item.UserData) {
          snapshot.set(keyStr, data);
          const updated = [...(data as MediaItem[])];
          updated[idx] = {
            ...item,
            UserData: { ...item.UserData, ...updater(item.UserData) },
          };
          qc.setQueryData(key, updated);
        }
      }
      continue;
    }

    // Queries infinies ({ pages: [{ Items: MediaItem[] }], pageParams })
    if (
      typeof data === "object" &&
      data !== null &&
      "pages" in data &&
      Array.isArray((data as InfiniteData<unknown>).pages)
    ) {
      const infiniteData = data as InfiniteData<{ Items?: MediaItem[] }>;
      let found = false;

      const updatedPages = infiniteData.pages.map((page) => {
        if (!page.Items) return page;
        const idx = page.Items.findIndex((item) => item.Id === itemId);
        if (idx === -1) return page;

        const item = page.Items[idx];
        if (!item.UserData) return page;

        found = true;
        const updatedItems = [...page.Items];
        updatedItems[idx] = {
          ...item,
          UserData: { ...item.UserData, ...updater(item.UserData) },
        };
        return { ...page, Items: updatedItems };
      });

      if (found) {
        snapshot.set(keyStr, data);
        qc.setQueryData(key, { ...infiniteData, pages: updatedPages });
      }
    }
  }

  return snapshot;
}

/**
 * Restaure tous les caches depuis le snapshot (rollback onError).
 */
export function restoreFromSnapshot(
  qc: QueryClient,
  snapshot: Map<string, unknown>,
): void {
  const allQueries = qc.getQueryCache().findAll();

  for (const query of allQueries) {
    const keyStr = JSON.stringify(query.queryKey);
    if (snapshot.has(keyStr)) {
      qc.setQueryData(query.queryKey, snapshot.get(keyStr));
    }
  }
}
