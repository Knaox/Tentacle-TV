import { JELLYFIN_AUTH_HEADER, JELLYFIN_TOKEN_HEADER } from "@tentacle-tv/shared";
import { directJellyfinHeaders, type useJellyfinClient } from "@tentacle-tv/api-client";

/**
 * En-têtes d'auth Jellyfin pour les lecteurs natifs (PrismCore, AVPlayer) —
 * INDISPENSABLES : quand le direct streaming n'est pas actif, l'URL passe par
 * le proxy Tentacle, qui retire le jeton de la query et authentifie par
 * en-tête (sinon 401 → `originRefused`) ; on lui parle `X-Emby-*`, que tout
 * serveur Tentacle lit. En direct, c'est `Authorization` : Jellyfin 12 refuse
 * les X-Emby-* (l'URL porte aussi `ApiKey`).
 */
export function nativePlayerHeaders(client: ReturnType<typeof useJellyfinClient>): Record<string, string> | undefined {
  const ds = client.getDirectStreaming?.();
  if (ds?.jellyfinToken) return directJellyfinHeaders(client.getAuthHeader(ds.jellyfinToken));
  const token = client.getAccessToken();
  if (!token) return undefined;
  return { [JELLYFIN_AUTH_HEADER]: client.getAuthHeader(token), [JELLYFIN_TOKEN_HEADER]: token };
}
