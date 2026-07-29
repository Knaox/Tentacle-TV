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
import { refreshItemTracksCache } from "./localItemTracks";
import { refreshAutoplayConfigCache } from "../hooks/useAutoplayConfigLocalFirst";

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
    // Langues retenues par CONTENU : la lecture d'un fichier téléchargé
    // n'interroge jamais le serveur, même en ligne — sans cette photo, un choix
    // fait sur un autre appareil resterait invisible ici.
    void refreshItemTracksCache(userId, backendUrl);
    // Seuil MaxResumePct de Jellyfin : c'est lui qui décide qu'un épisode est
    // vu, hors ligne comme en ligne. Le lecteur ne le demande jamais en lecture
    // locale (zéro réseau) — sans cette photo, un poste qui ne lit que des
    // téléchargements resterait sur la valeur de repli.
    void refreshAutoplayConfigCache(backendUrl);
  }, [userId, state]);

  return null;
}
