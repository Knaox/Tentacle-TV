import { useQuery } from "@tanstack/react-query";
import { useTentacleConfig, useUserId } from "@tentacle-tv/api-client";
import { NO_CAPABILITIES, type DownloadCapabilities } from "@tentacle-tv/offline-core";
import { LOCAL_QUERY } from "@tentacle-tv/offline-core/react";
import { cachedCapabilities, fetchCapabilities } from "@/offline/sessionPhoto";
import { useConnectivity } from "@/offline/useConnectivity";
import { useServerUrl } from "@/providers/ServerUrlContext";

export const OFFLINE_CAPABILITIES_QUERY_KEY = "offline-capabilities";

/**
 * Les droits de mise de côté du compte — LE commutateur d'invisibilité :
 * sans le droit, aucun bouton ni dialogue n'est rendu.
 *
 * En ligne : lecture live du backend (qui relit la policy Jellyfin), et la
 * réponse est photographiée dans la session locale. Hors ligne : repli sur
 * cette photo, tant que la session locale n'a pas expiré.
 */
export function useOfflineCapabilities(): { capabilities: DownloadCapabilities; fromOfflineCache: boolean } {
  const userId = useUserId();
  const { serverUrl } = useServerUrl();
  const { storage } = useTentacleConfig();
  const { state } = useConnectivity();
  const online = state === "online" || state === "checking";
  const token = storage.getItem("tentacle_token");
  const canFetch = userId !== null && serverUrl !== null && token !== null;

  const live = useQuery({
    queryKey: [OFFLINE_CAPABILITIES_QUERY_KEY, userId],
    queryFn: () => fetchCapabilities(serverUrl as string, token as string, userId as string, storage),
    enabled: canFetch && online,
    staleTime: 60_000,
    gcTime: 30 * 60_000,
    placeholderData: (previous) => previous,
  });

  const cached = useQuery({
    queryKey: [OFFLINE_CAPABILITIES_QUERY_KEY, "cache", userId],
    queryFn: () => cachedCapabilities(userId as string),
    enabled: userId !== null && !online,
    staleTime: 15_000,
    ...LOCAL_QUERY,
  });

  if (userId === null) return { capabilities: NO_CAPABILITIES, fromOfflineCache: false };
  if (!online) return { capabilities: cached.data ?? NO_CAPABILITIES, fromOfflineCache: true };
  return { capabilities: live.data ?? NO_CAPABILITIES, fromOfflineCache: false };
}
