/**
 * Hooks d'état des téléchargements (desktop uniquement — inertes ailleurs).
 * - liste par utilisateur, état par item (badges/boutons de fiche), espace ;
 * - visibilité de la fonctionnalité : le hors ligne appartient au COMPTE de
 *   l'appareil (`offline-core` › `offlineSurfaceOf`, la règle du mobile) —
 *   rien pendant une session de profil, rien pour un compte à qui le serveur
 *   refuse `keepOffline` (les fichiers restent : le droit revenu, tout
 *   reparaît) ; serveur d'avant : les capacités OU le contenu, comme avant.
 */

import { useQuery } from "@tanstack/react-query";
import { useUserId } from "@tentacle-tv/api-client";
import { offlineSurfaceOf } from "@tentacle-tv/offline-core";
import { supportsDownloads } from "../desktop/bridge";
import { getDiskFree, getDiskUsage, listDownloads, downloadStateForItem, type DownloadEntry } from "./api";
import { useDownloadCapabilities } from "./useDownloadCapabilities";
import { LOCAL_QUERY } from "@tentacle-tv/offline-core/react";

import { DISK_INFO_QUERY_KEY, DOWNLOAD_STATE_QUERY_KEY, DOWNLOADS_LIST_QUERY_KEY } from "./queryKeys";
import { useActiveProfile } from "../auth/profileSession";
import { useAccountKeepRight } from "../offline/offlineOwner";

export { DISK_INFO_QUERY_KEY, DOWNLOAD_STATE_QUERY_KEY, DOWNLOADS_LIST_QUERY_KEY };

export function useDownloadsList(): DownloadEntry[] {
  return useDownloadsListState().entries;
}

/**
 * La liste, et si elle est arrivée : une fiche locale ne conclut à l'absence
 * d'un titre qu'une fois la base lue — une liste vide peut n'être qu'en route.
 */
export function useDownloadsListState(): { entries: DownloadEntry[]; ready: boolean } {
  const userId = useUserId();
  const query = useQuery({
    queryKey: [DOWNLOADS_LIST_QUERY_KEY, userId],
    queryFn: () => listDownloads(userId as string),
    enabled: supportsDownloads() && !!userId,
    staleTime: 5_000,
    ...LOCAL_QUERY,
  });
  return { entries: query.data ?? EMPTY_LIST, ready: query.isFetched };
}

const EMPTY_LIST: DownloadEntry[] = [];

export function useItemDownloadState(itemId: string | undefined): DownloadEntry | null {
  const userId = useUserId();
  const query = useQuery({
    queryKey: [DOWNLOAD_STATE_QUERY_KEY, userId, itemId],
    queryFn: () => downloadStateForItem(userId as string, itemId as string),
    enabled: supportsDownloads() && !!userId && !!itemId,
    staleTime: 5_000,
    ...LOCAL_QUERY,
  });
  return query.data ?? null;
}

export interface DiskInfo {
  freeBytes: number | null;
  usedBytes: number | null;
}

export function useDiskInfo(): DiskInfo {
  const query = useQuery({
    queryKey: [DISK_INFO_QUERY_KEY],
    queryFn: async (): Promise<DiskInfo> => ({
      freeBytes: await getDiskFree(),
      usedBytes: await getDiskUsage(),
    }),
    enabled: supportsDownloads(),
    staleTime: 10_000,
    ...LOCAL_QUERY,
  });
  return query.data ?? { freeBytes: null, usedBytes: null };
}

export interface DownloadsVisibility {
  /** Au moins un point d'entrée doit être rendu (nav, écran). */
  visible: boolean;
  /** Droit de lancer de NOUVEAUX téléchargements. */
  canDownload: boolean;
  /** Droit au mode Allégé. */
  canLight: boolean;
  /** Du contenu local existe pour ce compte. */
  hasContent: boolean;
}

/**
 * LE commutateur d'invisibilité (`offlineSurfaceOf`) :
 * - session d'un PROFIL : rien, nulle part — le contenu gardé et le hors ligne
 *   sont ceux du compte de l'appareil ;
 * - compte à qui le serveur refuse `keepOffline` : rien (dernier mot retenu
 *   hors ligne) ;
 * - droit jamais su (hors ligne d'emblée) : le contenu déjà là, sans bouton ;
 * - hors ligne → capacités depuis la photo locale (capabilities en cache).
 */
export function useDownloadsVisibility(): DownloadsVisibility {
  const { capabilities } = useDownloadCapabilities();
  const list = useDownloadsList();
  const profileSession = useActiveProfile() !== null;
  const keepRight = useAccountKeepRight(profileSession);
  if (!supportsDownloads()) return { visible: false, canDownload: false, canLight: false, hasContent: false };
  const surface = offlineSurfaceOf({ profileSession, keepRight, engineCanKeep: capabilities.downloads, hasContent: list.length > 0 });
  return {
    visible: surface.visible,
    canDownload: surface.canKeep,
    canLight: surface.canKeep && capabilities.lightDownloads,
    hasContent: surface.visible && list.length > 0,
  };
}
