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
/* ------------------------------------------------------------------ */

import { createHmac, randomBytes, timingSafeEqual } from "crypto";

const SECRET = randomBytes(32);

/** Une bande-annonce dure quelques minutes ; quatre heures couvrent une fiche laissée ouverte. */
export const RELAY_TOKEN_TTL_MS = 4 * 60 * 60 * 1000;

function mac(ytId: string, expiry: number): string {
  return createHmac("sha256", SECRET).update(`${ytId}:${expiry}`).digest("base64url");
}

/** Le jeton d'accès aux flux relayés de `ytId`, valable `RELAY_TOKEN_TTL_MS`. */
export function signRelayToken(ytId: string, now = Date.now()): string {
  const expiry = Math.floor((now + RELAY_TOKEN_TTL_MS) / 1000);
  return `${expiry.toString(36)}.${mac(ytId, expiry)}`;
}

/** Le jeton ouvre-t-il les flux de `ytId` à cet instant ? */
export function verifyRelayToken(ytId: string, token: unknown, now = Date.now()): boolean {
  if (typeof token !== "string") return false;
  const [encoded, signature] = token.split(".");
  const expiry = parseInt(encoded ?? "", 36);
  if (!signature || !Number.isFinite(expiry) || expiry * 1000 < now) return false;
  const expected = Buffer.from(mac(ytId, expiry));
  const given = Buffer.from(signature);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
