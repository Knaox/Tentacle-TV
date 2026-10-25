/**
 * Octave — le jeton dans l'URL (`?api_key=<jeton>`), pour les SEULS `GET` du
 * flux d'un titre et d'une pochette. Un élément `<audio>` (ou `<img>`) ne pose
 * pas d'en-tête : un client à jeton sans cookie (bureau sans libmpv, Linux)
 * recevait 401 (mesures d'A2).
 *
 * Même règle que le proxy de Jellyfin (`routes/jellyfinProxy/incomingAuth.ts`) :
 * les en-têtes Jellyfin d'abord, puis le cookie départagé du jeton explicite
 * de l'URL par `chooseSessionToken` (un cookie de CONNEXION cède, une session
 * posée par le serveur l'emporte). Le jeton retenu passe ensuite par
 * `requireAuth`, exactement comme un `Bearer` : mêmes refus, mêmes portées de
 * profil. Aucune autre route ni méthode ne lit l'URL ; le jeton n'atteint
 * jamais Jellyfin (le relais bâtit sa propre requête) et les journaux le
 * masquent (`redactUrl` : `api_key=[redacted]`).
 */

import type { FastifyRequest } from "fastify";
import { readIncomingAuth } from "../../routes/jellyfinProxy/incomingAuth";
import { tokenFromQuery } from "../../services/jellyfinAuth";

/** Les routes (relatives au préfixe `/api/music`) qui acceptent le jeton de l'URL. */
const QUERY_TOKEN_ROUTES = new Set(["/stream/:id", "/artwork/:id"]);

export function acceptsQueryToken(method: string, routeUrl: string | undefined, prefix = "/api/music"): boolean {
  if (method !== "GET" || !routeUrl) return false;
  return QUERY_TOKEN_ROUTES.has(routeUrl.startsWith(prefix) ? routeUrl.slice(prefix.length) : routeUrl);
}

/**
 * Avant `requireAuth` : sur une route permise, le jeton retenu par la règle du
 * proxy devient le `Bearer` de la requête. Ailleurs, rien ne change.
 */
export function applyQueryToken(request: FastifyRequest): void {
  if (!acceptsQueryToken(request.method, request.routeOptions.url)) return;
  const query = request.query as Record<string, unknown> | undefined;
  if (!tokenFromQuery(query)) return;
  const cookie = (request as { cookies?: Record<string, string | undefined> }).cookies?.tentacle_token;
  const { token } = readIncomingAuth(request.headers, cookie, query);
  if (token) request.headers.authorization = `Bearer ${token}`;
}
