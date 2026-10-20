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
 * Ordre de préférence : en-têtes Jellyfin d'abord ; puis le cookie, départagé
 * du jeton EXPLICITE de la query (puis du `Bearer`) par la règle commune
 * (`sessionTokenChoice`) : un cookie de CONNEXION cède — AVPlayer sur iOS lit
 * le flux d'un profil avec `api_key=<jeton du profil>`, et le pot de React
 * Native y joint le cookie du COMPTE de l'appareil, qui faisait relayer le flux
 * au nom du compte, avec ses droits ; un cookie posé par le serveur à la place
 * du compte (profil du web, « voir en tant que ») l'emporte toujours. La page
 * web, elle, présente le même jeton des deux façons.
 */

import { incomingMediaBrowserAuth, tokenFromAuthHeaders, tokenFromQuery } from "../../services/jellyfinAuth";
import { chooseSessionToken } from "../../services/sessionTokenChoice";

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
  const explicit = tokenFromQuery(query as Record<string, unknown> | undefined) || bearer || undefined;
  const token = tokenFromAuthHeaders(headers) || chooseSessionToken(cookieToken || undefined, explicit);
  return { token, identity, identityHeader };
}
