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
import { backendUrl, isTauriApp } from "../main";
import { useConnectivity } from "./useConnectivity";
import { saveCachedSession } from "./offlineSession";
import { cacheLibraryPrefs } from "./localTrackPrefs";

export function OfflineSessionSync() {
  const userId = useUserId();
  const { state } = useConnectivity();

  useEffect(() => {
    if (!isTauriApp || !userId || state !== "online") return;
    try {
      const raw = localStorage.getItem("tentacle_user");
      if (raw) void saveCachedSession(userId, raw);
    } catch {
      /* localStorage inaccessible : rien à mettre en cache. */
    }
    // Préférences de pistes par bibliothèque — photographiées pour la
    // résolution simplifiée hors ligne (offlineTrackHints).
    try {
      const token = localStorage.getItem("tentacle_token");
      if (token) {
        void fetch(`${backendUrl}/api/preferences`, {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then((res) => (res.ok ? res.json() : null))
          .then((rows) => {
            if (rows) cacheLibraryPrefs(userId, rows);
          })
          .catch(() => {});
      }
    } catch {
      /* cache best-effort */
    }
  }, [userId, state]);

  return null;
}
