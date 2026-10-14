/* ------------------------------------------------------------------ */
/*  Le jeton des URL du relais des bandes-annonces                      */
/*                                                                     */
/*  AVPlayer ne pose pas d'en-tête `Authorization` sur les listes et   */
/*  les segments qu'il demande : l'accès se porte dans l'URL. Le jeton */
/*  lie UNE vidéo à une échéance, signée par un secret propre à ce     */
/*  processus — seule une vidéo qu'un compte connecté a résolue se     */
/*  laisse relayer, et le serveur ne devient pas un relais YouTube     */
/*  ouvert à qui connaît l'adresse. Un redémarrage invalide les jetons */
/*  en cours : la bande-annonce en lecture s'arrête, la suivante se    */
/*  résout de nouveau.                                                 */
/*                                                                     */
/*  Deux PORTÉES : `play` (`/resolve` — la TV lance la bande-annonce) */
/*  et `preview` (`/preview` — l'aperçu au survol). Un jeton d'aperçu */
/*  ne fait jamais ré-extraire : la vidéo que le relais a oubliée se  */
/*  redemande à `/preview`, qui seul tient les garde-fous de l'aperçu  */
/*  (seau, plafond, place unique, disjoncteur, budget).                */
/* ------------------------------------------------------------------ */

import { createHmac, randomBytes, timingSafeEqual } from "crypto";

const SECRET = randomBytes(32);

/** Une bande-annonce dure quelques minutes ; quatre heures couvrent une fiche laissée ouverte. */
export const RELAY_TOKEN_TTL_MS = 4 * 60 * 60 * 1000;

export type RelayScope = "play" | "preview";

/** La portée entre dans la signature : retirer la marque d'un jeton d'aperçu ne le change pas en jeton de lecture. */
function mac(ytId: string, expiry: number, scope: RelayScope): string {
  const subject = scope === "preview" ? `${ytId}:${expiry}:preview` : `${ytId}:${expiry}`;
  return createHmac("sha256", SECRET).update(subject).digest("base64url");
}

/** Le jeton d'accès aux flux relayés de `ytId`, valable `RELAY_TOKEN_TTL_MS` — `expiry.mac`, ou `expiry.p.mac` pour un aperçu. */
export function signRelayToken(ytId: string, now = Date.now(), scope: RelayScope = "play"): string {
  const expiry = Math.floor((now + RELAY_TOKEN_TTL_MS) / 1000);
  const encoded = expiry.toString(36);
  return scope === "preview" ? `${encoded}.p.${mac(ytId, expiry, scope)}` : `${encoded}.${mac(ytId, expiry, scope)}`;
}

/** La portée du jeton s'il ouvre les flux de `ytId` à cet instant ; `null` sinon. */
export function relayTokenScope(ytId: string, token: unknown, now = Date.now()): RelayScope | null {
  if (typeof token !== "string") return null;
  const parts = token.split(".");
  const [encoded, mark, signature] = parts.length === 3 ? parts : [parts[0], undefined, parts[1]];
  if (parts.length > 3 || (mark !== undefined && mark !== "p")) return null;
  const scope: RelayScope = mark === "p" ? "preview" : "play";
  const expiry = parseInt(encoded ?? "", 36);
  if (!signature || !Number.isFinite(expiry) || expiry * 1000 < now) return null;
  const expected = Buffer.from(mac(ytId, expiry, scope));
  const given = Buffer.from(signature);
  return given.length === expected.length && timingSafeEqual(given, expected) ? scope : null;
}

/** L'échéance (ms) qu'un jeton porte — lue sans le vérifier : `relayTokenScope` d'abord. */
export function relayTokenExpiry(token: string): number | null {
  const expiry = parseInt(token.split(".")[0] ?? "", 36);
  return Number.isFinite(expiry) ? expiry * 1000 : null;
}

/** Le jeton ouvre-t-il les flux de `ytId` à cet instant, quelle que soit sa portée ? */
export function verifyRelayToken(ytId: string, token: unknown, now = Date.now()): boolean {
  return relayTokenScope(ytId, token, now) !== null;
}
