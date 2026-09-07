import { useQuery } from "@tanstack/react-query";
import { useUserId } from "@tentacle-tv/api-client";
import { LOCAL_QUERY } from "@tentacle-tv/offline-core/react";
import { listOfflineEntries, offlineDiskInfo, offlineStateForItem, type OfflineEntry } from "@/offline/engineApi";

export const OFFLINE_LIST_QUERY_KEY = "offline-list";
export const OFFLINE_STATE_QUERY_KEY = "offline-state";
export const OFFLINE_DISK_QUERY_KEY = "offline-disk";

/**
 * Les listes locales, par TanStack Query : mêmes clés pour tous les écrans,
 * invalidées par `OfflineEventsBinding` à chaque évènement du moteur.
 * `LOCAL_QUERY` est OBLIGATOIRE : ces requêtes lisent SQLite, pas le réseau —
 * sans lui, hors ligne, elles resteraient en pause pour toujours.
 */
export function useOfflineList(userId: string | null) {
  return useQuery({
    queryKey: [OFFLINE_LIST_QUERY_KEY, userId],
    queryFn: () => listOfflineEntries(userId as string),
    enabled: userId !== null,
    staleTime: 5_000,
    ...LOCAL_QUERY,
  });
}

/** L'état d'un titre pour ce compte : le badge de fiche et le bouton d'épisode. */
export function useItemOfflineState(itemId: string | undefined) {
  const userId = useUserId();
  return useQuery({
    queryKey: [OFFLINE_STATE_QUERY_KEY, userId, itemId],
    queryFn: () => offlineStateForItem(userId as string, itemId as string),
    enabled: userId !== null && itemId !== undefined,
    staleTime: 5_000,
    ...LOCAL_QUERY,
  });
}

export function useDiskInfo() {
  return useQuery({
    queryKey: [OFFLINE_DISK_QUERY_KEY],
    queryFn: () => offlineDiskInfo(),
    staleTime: 5_000,
    ...LOCAL_QUERY,
  });
}

export interface OfflineActivity {
  /** Transferts en file ou en cours. */
  active: number;
  /** Titres prêts. */
  ready: number;
  total: number;
}

/** Ce que l'icône d'en-tête et la section du profil résument. */
export function useOfflineActivity(): OfflineActivity {
  const userId = useUserId();
  const { data } = useOfflineList(userId);
  const entries: OfflineEntry[] = data ?? [];
  let active = 0;
  let ready = 0;
  for (const entry of entries) {
    if (entry.status === "queued" || entry.status === "downloading") active += 1;
    else if (entry.status === "complete") ready += 1;
  }
  return { active, ready, total: entries.length };
}
