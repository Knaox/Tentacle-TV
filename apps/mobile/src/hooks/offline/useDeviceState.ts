import { useQuery } from "@tanstack/react-query";
import { useUserId } from "@tentacle-tv/api-client";
import { cardDeviceState, deviceIndexOf, type DeviceIndex, type DeviceItemState } from "@tentacle-tv/offline-core";
import { LOCAL_QUERY } from "@tentacle-tv/offline-core/react";
import type { CardDeviceState, MediaItem } from "@tentacle-tv/shared";
import { listOfflineEntries, type OfflineEntry } from "@/offline/engineApi";
import { OFFLINE_LIST_QUERY_KEY } from "./useOfflineList";

/**
 * « Sur cet appareil », lu par une carte, une ligne d'épisode, une feuille.
 *
 * Chaque appelant s'abonne à la liste locale PARTAGÉE (`offline-list`, mêmes
 * clé, requête et options que `useOfflineList`) à travers un `select` qui ne
 * rend qu'une valeur : TanStack Query ne réveille que la carte dont l'état
 * change. L'index (`deviceIndexOf`, offline-core) est construit une fois par
 * version de la liste — une saison de deux cents lignes interroge une `Map`,
 * là où chaque ligne lisait SQLite de son côté (`useItemOfflineState`) à
 * chaque évènement du moteur.
 */

const NO_GROUP = { kept: 0, active: 0 } as const;

function useDeviceSelect<T>(pick: (index: DeviceIndex) => T): T | undefined {
  const userId = useUserId();
  const { data } = useQuery({
    queryKey: [OFFLINE_LIST_QUERY_KEY, userId],
    queryFn: () => listOfflineEntries(userId as string),
    enabled: userId !== null,
    staleTime: 5_000,
    ...LOCAL_QUERY,
    select: (entries: OfflineEntry[]) => pick(deviceIndexOf(entries)),
  });
  return data;
}

/** Ce qu'une carte dit de l'appareil : le titre entier, des épisodes, ou rien. */
export function useCardDeviceState(item: Pick<MediaItem, "Id" | "Type">): CardDeviceState | null {
  return useDeviceSelect((index) => cardDeviceState(index, item)) ?? null;
}

/** L'état d'un film ou d'un épisode : prêt, en route, en échec, ou absent. */
export function useDeviceItemState(itemId: string | undefined): DeviceItemState | null {
  return useDeviceSelect((index) => (itemId ? index.itemState(itemId) : null)) ?? null;
}

/**
 * L'état d'un épisode pour sa LIGNE : prêt, en route, ou rien — un échec se
 * rattrape par un nouveau « garder », comme partout sur le mobile.
 */
export function useEpisodeOfflineState(itemId: string | undefined): "complete" | "active" | null {
  const state = useDeviceItemState(itemId);
  return state === "complete" || state === "active" ? state : null;
}

/** Ce que l'appareil garde d'une série (ou d'une saison) : épisodes prêts, épisodes en route. */
export function useDeviceGroupState(groupId: string | undefined): { kept: number; active: number } {
  // Un seul abonnement ; le partage structurel garde la même référence tant
  // que les deux nombres ne bougent pas.
  return useDeviceSelect((index) => (groupId ? { kept: index.keptIn(groupId), active: index.activeIn(groupId) } : NO_GROUP)) ?? NO_GROUP;
}
