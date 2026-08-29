import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useJellyfinClient,
  useStreamingConfig,
  STREAMING_CONFIG_QUERY_KEY,
  primeBitrateMeasure,
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

  // Préchauffe la mesure de débit (cache 10 min, fire-and-forget) dès qu'une
  // session existe : la PREMIÈRE lecture peut ainsi être capée si la connexion
  // ne suit pas — la décision de flux part au montage du player, trop tôt pour
  // mesurer sur place (cf. useTVAutoQualityCap).
  useEffect(() => { if (token) primeBitrateMeasure(client); }, [client, token]);

  useEffect(() => {
    if (data?.tokenExpired) {
      // Token Jellyfin de l'appareil expiré/révoqué : purge du cache hérité et
      // repli proxy temporaire SANS déconnecter — le backend re-fournit un
      // token frais (self-healing depuis un appareil frère du même compte) au
      // prochain poll, et le direct se réactive seul.
      console.warn("[DirectStreaming] Jellyfin token expired — waiting for a fresh token");
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
    } else if (isFetched && !isError) {
      // Le backend a répondu et le direct n'est PAS actif (désactivé, ou pas de
      // token) → mode proxy : tout passe par Tentacle (bon serveur Jellyfin).
      // Purge du cache hérité des anciennes versions (plus jamais réécrit).
      storage.removeItem("tentacle_jellyfin_url");
      storage.removeItem("tentacle_jellyfin_token");
      client.setDirectStreaming(null);
    }
    // isError (backend injoignable) : NE RIEN changer — l'état mémoire courant
    // reste tel quel et le poll suivant retentera. Plus JAMAIS de réactivation
    // depuis un cache local : un token/URL d'un ANCIEN jumelage envoyait la
    // lecture vers le mauvais serveur ou avec un token mort (401 « token
    // expiré » juste après un jumelage neuf).
  }, [client, data, isError, isFetched, storage]);

  useEffect(() => {
    client.setOnDirectStreamingFail(() => {
      qc.invalidateQueries({ queryKey: [STREAMING_CONFIG_QUERY_KEY] });
    });
  }, [client, qc]);

  return null;
}
