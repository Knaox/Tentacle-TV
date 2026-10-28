import type { IncomingHttpHeaders, OutgoingHttpHeaders } from "http";
import { RELAY_HEADERS } from "../pluginServerRuntime";

/**
 * Les en-têtes d'une requête RELAYÉE vers l'invité, et ceux de sa réponse
 * renvoyés au client. Vers l'invité : rien de ce qui authentifie le client
 * (`Authorization`, cookies, en-têtes de jeton Jellyfin), aucun `x-tentacle-*`
 * venu de lui, aucun en-tête de connexion ; puis `RELAY_HEADERS`, posés par
 * l'hôte seul. Vers le client : la réponse de l'invité, moins ce qui ne doit
 * pas traverser (cookies posés par l'invité, en-têtes de connexion).
 */

export interface RelayCaller {
  userId: string;
  userName: string;
  isAdmin: boolean;
  session: "personal" | "profile" | "device";
}

/** Retirés dans les deux sens : ils décrivent UNE connexion, pas la requête. */
const HOP_BY_HOP = new Set([
  "connection", "keep-alive", "proxy-authenticate", "proxy-authorization", "te", "trailer", "transfer-encoding", "upgrade", "host",
]);

/**
 * Un nom d'en-tête vient du client ou de l'invité : jamais une clé qui toucherait le prototype de l'objet
 * construit (« __proto__ » est un nom d'en-tête valide). Les objets rendus n'ont pas de prototype non plus.
 */
const PROTOTYPE_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/** Ce qui authentifie le client auprès du cœur ou de Jellyfin : jamais pour l'invité. */
const CLIENT_SECRETS = new Set(["authorization", "cookie", "x-emby-token", "x-emby-authorization", "x-mediabrowser-token"]);

export function guestRequestHeaders(
  incoming: IncomingHttpHeaders,
  caller: RelayCaller | null,
  locale: string,
  requestId: string,
): OutgoingHttpHeaders {
  const out: OutgoingHttpHeaders = Object.create(null);
  for (const [name, value] of Object.entries(incoming)) {
    const key = name.toLowerCase();
    if (value === undefined || PROTOTYPE_KEYS.has(key) || HOP_BY_HOP.has(key) || CLIENT_SECRETS.has(key) || key.startsWith("x-tentacle-")) continue;
    // Le client ne dit pas d'où il vient à l'invité : l'hôte le sait, l'invité n'en a pas besoin.
    if (key === "x-forwarded-for" || key === "x-real-ip" || key === "forwarded") continue;
    out[key] = value;
  }
  out.host = "tentacle-plugin";
  if (caller) {
    out[RELAY_HEADERS.userId] = caller.userId;
    // Un nom ASCII imprimable passe tel quel ; tout autre (accents, contrôles) part encodé en URI.
    const name = caller.userName.slice(0, 120);
    out[RELAY_HEADERS.userName] = /^[\x20-\x7e]*$/.test(name) ? name : encodeURIComponent(name);
    out[RELAY_HEADERS.isAdmin] = caller.isAdmin ? "1" : "0";
    out[RELAY_HEADERS.session] = caller.session;
  }
  out[RELAY_HEADERS.locale] = locale;
  out[RELAY_HEADERS.requestId] = requestId;
  return out;
}

export function clientResponseHeaders(incoming: IncomingHttpHeaders): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = Object.create(null);
  for (const [name, value] of Object.entries(incoming)) {
    const key = name.toLowerCase();
    if (value === undefined || PROTOTYPE_KEYS.has(key) || HOP_BY_HOP.has(key) || key === "set-cookie" || key.startsWith("x-tentacle-")) continue;
    // CORS et sécurité : ceux du cœur, jamais ceux de l'invité.
    if (key.startsWith("access-control-") || key === "content-security-policy" || key === "strict-transport-security") continue;
    out[key] = value;
  }
  return out;
}

/** La session vue par l'invité : une session de profil ou d'appareil regarde, elle n'administre pas. */
export function relaySessionOf(session: string | undefined): RelayCaller["session"] {
  if (session === "personal") return "personal";
  if (session === "tvProfile" || session === "impersonation") return "profile";
  return "device";
}

/** La langue de la requête (deux lettres), sinon celle du serveur. */
export function relayLocale(acceptLanguage: string | undefined, serverLocale: string): string {
  const lang = acceptLanguage?.trim().slice(0, 2).toLowerCase();
  return lang && /^[a-z]{2}$/.test(lang) ? lang : serverLocale;
}
