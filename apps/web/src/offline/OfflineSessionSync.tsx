/**
 * Rafraîchit le cache de session hors ligne (desktop) : à chaque passage
 * « online » et à chaque changement d'utilisateur connecté, la photo du profil
 * (`tentacle_user`, qui inclut la Policy Jellyfin du moment du login) est
 * poussée en SQLite — ce qui fait GLISSER le TTL de 30 jours.
 * La policy à jour (capabilities) est poussée séparément par le hook des
 * droits de téléchargement. Ne rend rien.
 */

import { useEffect } from "react";
import { useUserId } from "@tentacle-tv/api-client";
import { backendUrl } from "../main";
import { supportsOfflineSession } from "../desktop/bridge";
import { useConnectivity } from "./useConnectivity";
import { saveCachedSession } from "./offlineSession";
import { refreshLibrariesCache, refreshLibraryPrefsCache } from "./localTrackPrefs";

export function OfflineSessionSync() {
  const userId = useUserId();
  const { state } = useConnectivity();

  useEffect(() => {
    if (!supportsOfflineSession() || !userId || state !== "online") return;
    try {
      const raw = localStorage.getItem("tentacle_user");
      if (raw) void saveCachedSession(userId, raw);
    } catch {
      /* localStorage inaccessible : rien à mettre en cache. */
    }
    // Préférences de pistes par bibliothèque — photographiées pour leur
    // résolution hors ligne (useLocalPlaybackTracks) — et liste des
    // bibliothèques (page Préférences utilisable hors ligne).
    void refreshLibraryPrefsCache(userId, backendUrl);
    void refreshLibrariesCache(userId, backendUrl);
  }, [userId, state]);

  return null;
}
