/**
 * « Sur cette machine », lu par une carte ou une ligne — bureau seulement.
 *
 * Chaque appelant s'abonne à la liste locale PARTAGÉE (`downloads-list`, mêmes
 * clé, requête et options que `useDownloadsListState`) à travers un `select`
 * qui ne rend qu'une valeur : TanStack Query ne réveille que la carte dont
 * l'état change. L'index (`deviceIndexOf`, offline-core) est construit une
 * fois par version de la liste — une `Map`, jamais un `find()` par carte.
 *
 * Hors du bureau, les hooks ne s'abonnent à RIEN : l'implémentation est
 * choisie une fois, au chargement du module, comme la détection du pont.
 */

import { useQuery } from "@tanstack/react-query";
import { useUserId } from "@tentacle-tv/api-client";
import { cardDeviceState, deviceIndexOf, type DeviceIndex, type DeviceItemState } from "@tentacle-tv/offline-core";
import { LOCAL_QUERY } from "@tentacle-tv/offline-core/react";
import type { CardDeviceState, MediaItem } from "@tentacle-tv/shared";
import { supportsDownloads } from "../desktop/bridge";
import { listDownloads, type DownloadEntry } from "./api";
import { DOWNLOADS_LIST_QUERY_KEY } from "./queryKeys";

const NO_GROUP = { kept: 0, active: 0 } as const;

function useDeviceSelect<T>(pick: (index: DeviceIndex) => T): T | undefined {
  const userId = useUserId();
  const { data } = useQuery({
    queryKey: [DOWNLOADS_LIST_QUERY_KEY, userId],
    queryFn: () => listDownloads(userId as string),
    enabled: !!userId,
    staleTime: 5_000,
    ...LOCAL_QUERY,
    select: (entries: DownloadEntry[]) => pick(deviceIndexOf(entries)),
  });
  return data;
}

/** Ce qu'une carte dit de la machine : le titre entier, des épisodes, ou rien. */
function useCardDeviceStateDesktop(item: Pick<MediaItem, "Id" | "Type">): CardDeviceState | null {
  return useDeviceSelect((index) => cardDeviceState(index, item)) ?? null;
}

/** L'état d'un film ou d'un épisode : prêt, en route, en échec, ou absent. */
function useDeviceItemStateDesktop(itemId: string): DeviceItemState | null {
  return useDeviceSelect((index) => index.itemState(itemId)) ?? null;
}

/** Ce que la machine garde d'une série (ou d'une saison) : épisodes prêts, épisodes en route. */
function useDeviceGroupStateDesktop(groupId: string): { kept: number; active: number } {
  // Un seul abonnement ; le partage structurel de TanStack garde la même
  // référence tant que les deux nombres ne bougent pas.
  return useDeviceSelect((index) => ({ kept: index.keptIn(groupId), active: index.activeIn(groupId) })) ?? NO_GROUP;
}

const DESKTOP = supportsDownloads();

export const useCardDeviceState: (item: Pick<MediaItem, "Id" | "Type">) => CardDeviceState | null =
  DESKTOP ? useCardDeviceStateDesktop : () => null;

export const useDeviceItemState: (itemId: string) => DeviceItemState | null =
  DESKTOP ? useDeviceItemStateDesktop : () => null;

export const useDeviceGroupState: (groupId: string) => { kept: number; active: number } =
  DESKTOP ? useDeviceGroupStateDesktop : () => NO_GROUP;
