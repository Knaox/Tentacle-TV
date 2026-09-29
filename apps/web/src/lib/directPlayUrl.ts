import { withDirectApiKey, type JellyfinClient } from "@tentacle-tv/api-client";

/**
 * L'URL de lecture DIRECTE d'une source — le fichier tel quel, ce que mpv lit.
 *
 * Une seule écriture pour deux appelants : la négociation de lecture
 * (`usePlaybackInfo.ts`) et le préchargement (`mediaWarmup.ts`), qui doit
 * réchauffer EXACTEMENT le fichier que la lecture ouvrira.
 *
 * En direct, `ApiKey` : Jellyfin 12 refuse `api_key` ; vers le proxy,
 * `api_key`, que tout serveur Tentacle lit.
 */
export function directPlayUrl(client: JellyfinClient, itemId: string, mediaSourceId: string): string {
  const path = `/Videos/${itemId}/stream?Static=true&MediaSourceId=${mediaSourceId}`;
  const ds = client.getDirectStreaming();
  return ds
    ? withDirectApiKey(`${ds.mediaBaseUrl}${path}`, ds.jellyfinToken)
    : `${client.getBaseUrl()}${path}&api_key=${client.getAccessToken() ?? ""}`;
}
