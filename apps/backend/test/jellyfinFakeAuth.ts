/**
 * Ce qu'un FAUX Jellyfin de test reconnaît comme authentification : seulement
 * les formes que Jellyfin 12 garde par défaut — l'en-tête
 * `Authorization: MediaBrowser … Token="…"` et le paramètre `ApiKey`.
 *
 * Un faux serveur qui accepterait encore `X-Emby-Token` laisserait passer une
 * régression que le vrai refuse (401 sur toute l'app) : c'est précisément ce
 * qui était arrivé avant la suite de compatibilité.
 */

import { authParam, parseMediaBrowserAuth } from "../src/services/jellyfinAuth";

/** Le jeton porté par une requête sortante du backend, ou "" s'il n'y en a pas. */
export function modernJellyfinToken(headers: HeadersInit | undefined, url?: string): string {
  const fromHeader = authParam(parseMediaBrowserAuth(new Headers(headers).get("authorization")), "Token");
  if (fromHeader) return fromHeader;
  if (!url) return "";
  try {
    for (const [k, v] of new URL(url, "http://jellyfin.test").searchParams) if (k.toLowerCase() === "apikey") return v;
  } catch {
    // URL relative ou illisible : pas de jeton.
  }
  return "";
}
