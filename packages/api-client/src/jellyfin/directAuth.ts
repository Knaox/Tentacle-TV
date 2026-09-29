/**
 * Parler à Jellyfin EN DIRECT (mode « streaming direct ») : la seule forme
 * d'authentification que Jellyfin 12 garde par défaut — l'en-tête
 * `Authorization: MediaBrowser … Token="…"` et le paramètre `ApiKey`.
 * `X-Emby-Token`, `X-Emby-Authorization` et `api_key` y valent un 401
 * (jellyfin#15559, #16992), et le sont aussi sur un 10.11 dont l'option est
 * coupée. Les deux formes gardées marchent depuis 10.10 au moins (mesuré).
 *
 * Les appels au PROXY Tentacle, eux, gardent `X-Emby-Token` /
 * `X-Emby-Authorization` (`JELLYFIN_*_HEADER`) : un serveur Tentacle ancien ne
 * lit qu'elles, et un serveur à jour les traduit pour Jellyfin.
 */

/** Les en-têtes d'un appel direct ; `authHeader` = `client.getAuthHeader(jeton)`. */
export function directJellyfinHeaders(authHeader: string): Record<string, string> {
  return { Authorization: authHeader };
}

/**
 * Le jeton d'une URL qui part EN DIRECT chez Jellyfin : `ApiKey`, tout
 * `api_key` / `ApiKey` déjà présent (toute casse) retiré. Les autres
 * paramètres gardent leur encodage d'origine — une `TranscodingUrl` de
 * Jellyfin se recopie telle quelle.
 */
export function withDirectApiKey(url: string, token: string): string {
  const q = url.indexOf("?");
  const path = q < 0 ? url : url.slice(0, q);
  const params = (q < 0 ? "" : url.slice(q + 1))
    .split("&")
    .filter((p) => p !== "" && !/^(api_key|apikey)=/i.test(p));
  params.push(`ApiKey=${encodeURIComponent(token)}`);
  return `${path}?${params.join("&")}`;
}
