/**
 * Ce qu'une requête entrante présente comme authentification, quelle que
 * soit la génération du client qui l'envoie.
 *
 * Les clients Tentacle déjà installés parlent au proxy avec les formes
 * héritées de Jellyfin (`X-Emby-Token`, `X-Emby-Authorization`, `api_key`) ;
 * un client à jour peut envoyer `Authorization: MediaBrowser …` ; la page web
 * n'envoie qu'un cookie ; le relais des extensions mobiles, un `Bearer`. Le
 * proxy les accepte TOUTES en entrée — et n'en relaie qu'une seule à Jellyfin
 * (cf. `buildForwardHeaders`), la seule que 12.x garde.
 *
 * Ordre de préférence, celui qu'avait déjà le proxy : en-têtes Jellyfin, puis
 * cookie, puis jeton en query ; le `Bearer` vient en dernier.
 */

import { incomingMediaBrowserAuth, tokenFromAuthHeaders, tokenFromQuery } from "../../services/jellyfinAuth";

type HeaderBag = Record<string, string | string[] | undefined>;

export interface IncomingAuth {
  /** Le jeton présenté (Jellyfin natif, JWT d'appareil ou d'usurpation). */
  token: string | undefined;
  /** L'identité d'appareil annoncée (Client, Device, DeviceId, Version). */
  identity: Record<string, string> | null;
  /** L'en-tête `MediaBrowser` brut, pour nommer un téléviseur jumelé. */
  identityHeader: string | undefined;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function readIncomingAuth(headers: HeaderBag, cookieToken: string | undefined, query: unknown): IncomingAuth {
  const authorization = first(headers["authorization"]);
  const bearer = authorization?.startsWith("Bearer ") ? authorization.slice(7).trim() : undefined;
  const identity = incomingMediaBrowserAuth(headers);
  const identityHeader = identity
    ? (authorization && !bearer ? authorization : first(headers["x-emby-authorization"]))
    : undefined;
  const token = tokenFromAuthHeaders(headers)
    || cookieToken
    || tokenFromQuery(query as Record<string, unknown> | undefined)
    || bearer
    || undefined;
  return { token, identity, identityHeader };
}
