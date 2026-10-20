import type { IncomingHttpHeaders } from "node:http";

/**
 * Quel jeton fait foi quand une requête en présente deux : le cookie de
 * session (`tentacle_token`) et un jeton EXPLICITE (`Authorization: Bearer`,
 * message `auth` de la socket).
 *
 * Le cookie est l'identifiant du NAVIGATEUR. Mais le serveur le pose à quiconque
 * se connecte par `/api/auth/login` ou rafraîchit un jeton Jellyfin — le
 * téléphone compris —, et React Native le garde puis le renvoie avec chaque
 * requête ET chaque poignée de main WebSocket (iOS comme Android, sans aucun
 * SameSite). En session de profil de la Famille, ce cookie porte le jeton du
 * COMPTE de l'appareil : lu d'abord, il faisait du compte l'hôte, l'invité et
 * le présent de Watch Together à la place du profil (alpha mobile, 20/10).
 *
 * La règle : le jeton explicite l'emporte sur un cookie qui porte une
 * CONNEXION (un jeton Jellyfin). Un cookie que le serveur a lui-même posé À LA
 * PLACE du compte — la session de profil du web, compte en réserve, ou « voir
 * en tant que » : un JWT — l'emporte toujours, même devant le Bearer du compte
 * (`test/familyPickerWeb.test.ts`). Une page web envoie de toute façon le même
 * jeton des deux façons : pour elle, rien ne change.
 */

/** Une session posée par le serveur dans le cookie à la place du compte : un
 *  JWT (jeton d'appareil d'un profil, « voir en tant que »). Un jeton Jellyfin
 *  n'a pas de point. */
export function isServerPlacedSession(token: string): boolean {
  return token.split(".").length === 3;
}

/** Le jeton qui fait foi entre le cookie et le jeton explicite (absents : `undefined`). */
export function chooseSessionToken(cookie: string | undefined, explicit: string | undefined): string | undefined {
  if (!cookie) return explicit || undefined;
  if (!explicit || explicit === cookie || isServerPlacedSession(cookie)) return cookie;
  return explicit;
}

/**
 * La socket : le cookie de la poignée de main l'authentifie-t-il AUSSITÔT ?
 * Oui pour une session posée par le serveur (rien ne la remplace), et pour un
 * navigateur — tous s'annoncent « Mozilla/… », Electron et les TV web
 * compris : la page web peut n'avoir que ce cookie. Non pour une application
 * native : React Native n'envoie pas de User-Agent (iOS) ou celui d'OkHttp
 * (Android) ; elle s'annonce par le message `auth`, qui l'emporte, et le
 * cookie de son pot n'est qu'un repli, au bout de `WS_COOKIE_FALLBACK_MS`,
 * pour un client muet. Jamais `Sec-Fetch-Mode` : la WebSocket de Node l'envoie
 * aussi (mesuré). Une erreur d'aiguillage ne coûte qu'un délai, ou une liaison
 * provisoire : le message `auth` l'emporte de toute façon.
 */
export function cookieDecidesAtOnce(cookie: string, headers: IncomingHttpHeaders): boolean {
  return isServerPlacedSession(cookie) || isBrowserAgent(headers);
}

/** Un navigateur — page web, Electron, TV web : tous s'annoncent « Mozilla/… ».
 *  React Native jamais (pas de User-Agent sur iOS, celui d'OkHttp sur Android). */
export function isBrowserAgent(headers: IncomingHttpHeaders): boolean {
  const agent = headers["user-agent"];
  return typeof agent === "string" && agent.startsWith("Mozilla/");
}

/** Le repli d'une socket native sur le cookie de son pot, faute de message `auth`
 *  (un client natif l'envoie à l'ouverture : il n'attend jamais ce délai). */
export const WS_COOKIE_FALLBACK_MS = 3_000;
