/**
 * Hooks d'état des téléchargements (desktop uniquement — inertes ailleurs).
 * - liste par utilisateur, état par item (badges/boutons de fiche), espace ;
 * - visibilité de la fonctionnalité : droits (capabilities) OU contenu local
 *   existant (décision « droit retiré → l'existant reste lisible ») ; un
 *   compte sans droit ET sans contenu ne voit RIEN.
 */

import { useQuery } from "@tanstack/react-query";
import { useUserId } from "@tentacle-tv/api-client";
import { supportsDownloads } from "../desktop/bridge";
import { getDiskFree, getDiskUsage, listDownloads, downloadStateForItem, type DownloadEntry } from "./api";
import { useDownloadCapabilities } from "./useDownloadCapabilities";
import { LOCAL_QUERY } from "../offline/localQuery";

export const DOWNLOADS_LIST_QUERY_KEY = "downloads-list";
export const DOWNLOAD_STATE_QUERY_KEY = "download-state";
export const DISK_INFO_QUERY_KEY = "downloads-disk";

export function useDownloadsList(): DownloadEntry[] {
  const userId = useUserId();
  const query = useQuery({
    queryKey: [DOWNLOADS_LIST_QUERY_KEY, userId],
    queryFn: () => listDownloads(userId as string),
    enabled: supportsDownloads() && !!userId,
    staleTime: 5_000,
    ...LOCAL_QUERY,
  });
  return query.data ?? [];
}

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
 * LE commutateur d'invisibilité :
 * - jamais de droit ET aucun contenu → rien n'est rendu, nulle part ;
 * - droit retiré mais contenu présent → l'écran Téléchargements et la lecture
 *   restent, AUCUN bouton de téléchargement (canDownload=false) ;
 * - hors ligne → droits depuis la photo locale (capabilities en cache).
 */
export function useDownloadsVisibility(): DownloadsVisibility {
  const { capabilities } = useDownloadCapabilities();
  const list = useDownloadsList();
  const hasContent = list.length > 0;
  if (!supportsDownloads()) {
    return { visible: false, canDownload: false, canLight: false, hasContent: false };
  }
  return {
    visible: capabilities.downloads || hasContent,
    canDownload: capabilities.downloads,
    canLight: capabilities.lightDownloads,
    hasContent,
  };
}
