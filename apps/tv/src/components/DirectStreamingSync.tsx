import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useJellyfinClient,
  useStreamingConfig,
  STREAMING_CONFIG_QUERY_KEY,
} from "@tentacle-tv/api-client";
import type { StorageAdapter } from "@tentacle-tv/api-client";
import { navigationRef } from "../navigation/navigationRef";

interface Props {
  storage: StorageAdapter;
}

/**
 * Synchronise la config de direct streaming (depuis le backend Tentacle)
 * dans le JellyfinClient. Permet de bypasser le proxy backend pour les
 * URLs de stream/sous-titres → moins de latence, moins de charge backend.
 *
 * Extraction depuis App.tsx pour respecter la limite de 300 lignes par fichier.
 */
export function DirectStreamingSync({ storage }: Props) {
  const client = useJellyfinClient();
  const qc = useQueryClient();

  // Token réactif : après pairing/login le token change, mais ce composant
  // est déjà monté. Polling du storage pour récupérer les nouveaux tokens.
  const [token, setToken] = useState<string | null>(storage.getItem("tentacle_token"));
  useEffect(() => {
    const id = setInterval(() => {
      const current = storage.getItem("tentacle_token");
      setToken((prev) => (current !== prev ? current : prev));
    }, 2000);
    return () => clearInterval(id);
  }, [storage]);

  const { data, isError, isFetched } = useStreamingConfig(token);

  useEffect(() => {
    if (data?.tokenExpired) {
      // Token Jellyfin issu du pairing expiré — force re-login
      storage.removeItem("tentacle_jellyfin_token");
      client.setDirectStreaming(null);
      if (navigationRef.isReady()) {
        navigationRef.reset({ index: 0, routes: [{ name: "Login" }] });
      }
      return;
    }
    if (data?.enabled && data.mediaBaseUrl && data.jellyfinToken) {
      client.setDirectStreaming({
        enabled: true,
        mediaBaseUrl: data.mediaBaseUrl,
        jellyfinToken: data.jellyfinToken,
      });
      // Cache local pour fallback si le backend devient injoignable
      storage.setItem("tentacle_jellyfin_url", data.mediaBaseUrl);
      storage.setItem("tentacle_jellyfin_token", data.jellyfinToken);
    } else if (isError || (isFetched && (!data?.enabled || !data?.jellyfinToken))) {
      // Fallback : tenter le direct streaming depuis les credentials Jellyfin en cache
      const jfUrl = storage.getItem("tentacle_jellyfin_url");
      const jfToken = storage.getItem("tentacle_jellyfin_token");
      if (jfUrl && jfToken) {
        client.setDirectStreaming({ enabled: true, mediaBaseUrl: jfUrl, jellyfinToken: jfToken });
      } else {
        client.setDirectStreaming(null);
      }
    }
  }, [client, data, isError, isFetched, storage]);

  useEffect(() => {
    client.setOnDirectStreamingFail(() => {
      qc.invalidateQueries({ queryKey: [STREAMING_CONFIG_QUERY_KEY] });
    });
  }, [client, qc]);

  return null;
}
