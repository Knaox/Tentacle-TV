/**
 * Capacités de téléchargement de l'utilisateur courant — LE commutateur
 * d'invisibilité : `downloads: false` ⇒ aucun composant lié n'est rendu.
 *
 * Desktop uniquement (`supportsDownloads()`) — sur le web, toujours tout à false.
 * En ligne : lecture live du backend (qui relit la policy Jellyfin), et la
 * réponse est photographiée dans le cache de session hors ligne (SQLite).
 * Hors ligne : repli sur cette photo (si la session locale n'a pas expiré).
 */

import { useQuery } from "@tanstack/react-query";
import { useUserId } from "@tentacle-tv/api-client";
import { backendUrl } from "../main";
import { supportsDownloads } from "../desktop/bridge";
import { useConnectivity } from "../offline/useConnectivity";
import { getCachedSession, saveCachedSession } from "../offline/offlineSession";
import { LOCAL_QUERY } from "../offline/localQuery";

export interface DownloadCapabilities {
  downloads: boolean;
  lightDownloads: boolean;
}

export const DOWNLOAD_CAPABILITIES_QUERY_KEY = "download-capabilities";

const NONE: DownloadCapabilities = { downloads: false, lightDownloads: false };

function parseCapabilities(raw: unknown): DownloadCapabilities {
  if (raw && typeof raw === "object") {
    const value = raw as Partial<DownloadCapabilities>;
    return {
      downloads: value.downloads === true,
      lightDownloads: value.lightDownloads === true,
    };
  }
  return NONE;
}

async function fetchCapabilities(userId: string): Promise<DownloadCapabilities> {
  const token = localStorage.getItem("tentacle_token");
  if (!token) return NONE;
  const res = await fetch(`${backendUrl}/api/downloads/capabilities`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return NONE;
  const caps = parseCapabilities(await res.json());
  // Photo pour le hors ligne : profil (localStorage) + droits — fait aussi
  // glisser le TTL de 30 jours de la session locale.
  try {
    const profile = localStorage.getItem("tentacle_user");
    if (profile) void saveCachedSession(userId, profile, JSON.stringify(caps));
  } catch {
    /* cache best-effort */
  }
  return caps;
}

async function readCachedCapabilities(userId: string): Promise<DownloadCapabilities> {
  const entry = await getCachedSession(userId);
  if (!entry || entry.expired || !entry.policyJson) return NONE;
  try {
    return parseCapabilities(JSON.parse(entry.policyJson));
  } catch {
    return NONE;
  }
}

export function useDownloadCapabilities(): {
  capabilities: DownloadCapabilities;
  /** true quand les droits viennent de la photo locale (mode hors ligne). */
  fromOfflineCache: boolean;
} {
  const userId = useUserId();
  const { state } = useConnectivity();
  const online = state === "online" || state === "checking";

  const liveQuery = useQuery({
    queryKey: [DOWNLOAD_CAPABILITIES_QUERY_KEY, userId],
    queryFn: () => fetchCapabilities(userId as string),
    enabled: supportsDownloads() && !!userId && online,
    staleTime: 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: true,
    placeholderData: (previous) => previous,
  });

  const cachedQuery = useQuery({
    queryKey: [DOWNLOAD_CAPABILITIES_QUERY_KEY, "offline-cache", userId],
    queryFn: () => readCachedCapabilities(userId as string),
    enabled: supportsDownloads() && !!userId && !online,
    staleTime: 15_000,
    // Lit SQLite par IPC : sans ceci, la requete est mise en PAUSE hors
    // ligne, les droits restent a `false`, et toute la section disparait —
    // y compris l'entree du header — au moment precis ou elle sert.
    ...LOCAL_QUERY,
  });

  if (!supportsDownloads() || !userId) return { capabilities: NONE, fromOfflineCache: false };
  if (!online) return { capabilities: cachedQuery.data ?? NONE, fromOfflineCache: true };
  return { capabilities: liveQuery.data ?? NONE, fromOfflineCache: false };
}
