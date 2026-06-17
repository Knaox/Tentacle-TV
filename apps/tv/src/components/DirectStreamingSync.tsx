import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useJellyfinClient,
  useStreamingConfig,
  STREAMING_CONFIG_QUERY_KEY,
} from "@tentacle-tv/api-client";
import type { StorageAdapter } from "@tentacle-tv/api-client";

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
      // Token Jellyfin issu du pairing expiré/révoqué — on dégrade en mode
      // proxy backend (les flux passent par Tentacle) SANS déconnecter : la
      // session de l'appareil (JWT Tentacle) reste valide, seul le raccourci
      // direct-vers-Jellyfin est perdu.
      console.warn("[DirectStreaming] Jellyfin token expired — falling back to backend proxy");
      storage.removeItem("tentacle_jellyfin_token");
      storage.removeItem("tentacle_jellyfin_url");
      client.setDirectStreaming(null);
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
    } else if (isError) {
      // Backend INJOIGNABLE uniquement : on tente le direct depuis le cache local.
      // (Si le backend répond « disabled », on NE doit PAS réactiver le direct —
      //  sinon un cache périmé d'un ancien jumelage envoie la lecture vers le
      //  mauvais serveur Jellyfin → PlaybackInfo 404 → chargement infini.)
      const jfUrl = storage.getItem("tentacle_jellyfin_url");
      const jfToken = storage.getItem("tentacle_jellyfin_token");
      if (jfUrl && jfToken) {
        client.setDirectStreaming({ enabled: true, mediaBaseUrl: jfUrl, jellyfinToken: jfToken });
      } else {
        client.setDirectStreaming(null);
      }
    } else if (isFetched) {
      // Le backend a répondu et le direct n'est PAS actif (désactivé, ou pas de
      // token) → mode proxy : tout passe par Tentacle (bon serveur Jellyfin).
      // On purge le cache direct périmé pour ne pas le ressortir si le backend
      // devient injoignable plus tard.
      storage.removeItem("tentacle_jellyfin_url");
      storage.removeItem("tentacle_jellyfin_token");
      client.setDirectStreaming(null);
    }
  }, [client, data, isError, isFetched, storage]);

  useEffect(() => {
    client.setOnDirectStreamingFail(() => {
      qc.invalidateQueries({ queryKey: [STREAMING_CONFIG_QUERY_KEY] });
    });
  }, [client, qc]);

  return null;
}
