import { getPrisma, hasPrisma } from "./db";
import { hashToken } from "./jwt";
import { getJellyfinUrl } from "./configStore";
import { jellyfinAuthHeaders } from "./jellyfinAuth";
import { ensureOwnJellyfinToken } from "./deviceJellyfinToken";

/**
 * Le jeton Jellyfin d'un appareil jumelé : à qui il appartient, et lequel
 * utiliser.
 *
 * Un appareil jumelé (TV, LG, provisioning) ne s'authentifie jamais auprès de
 * Jellyfin : le serveur frappe pour lui un jeton PROPRE (`deviceJellyfinToken`).
 * Tout ce qui parle à Jellyfin en son nom — lecture directe, reports de
 * lecture du proxy, canal de session — passe par ce jeton, et Jellyfin
 * attribue au PORTEUR du jeton, pas à l'utilisateur de l'URL.
 *
 * D'où la règle de ce module : **un jeton n'est rendu que s'il appartient au
 * compte de l'appareil.** « Valide » ne suffisait pas — mesuré sur une Apple
 * TV jumelée au compte Knaoxtest qui portait le jeton du compte Knaox :
 * l'écran montrait Knaoxtest, chaque position de lecture partait sur Knaox
 * (visible sur son iPhone, jamais sur la TV). Le jumelage capturait le jeton de
 * l'en-tête `Authorization` alors que l'utilisateur était identifié par le
 * cookie : deux sources, deux comptes possibles dans un même navigateur.
 */

/** Propriété d'un jeton vis-à-vis d'un compte. `unknown` : Jellyfin
 *  injoignable ou réponse inexploitable — on ne tranche pas. */
export type TokenOwnership = "own" | "foreign" | "invalid" | "unknown";

const OWNER_TTL_MS = 10 * 60_000;
const OWNER_CACHE_MAX = 500;
/** Clé = hash du jeton (jamais le jeton en clair en mémoire longue). */
const ownerCache = new Map<string, { userId: string; expiresAt: number }>();

/** Évite de relancer N validations /Users/Me concurrentes pour le même device
 *  (les reports de progression arrivent en rafale). Clé = tokenHash. */
const inFlight = new Set<string>();

function sameJellyfinId(a: string, b: string): boolean {
  const fold = (id: string) => id.replace(/-/g, "").toLowerCase();
  return fold(a) === fold(b);
}

/**
 * L'id Jellyfin du porteur du jeton, tel que `/Users/Me` le rend. `null` :
 * Jellyfin le refuse (401/403). `undefined` : on n'a pas pu savoir. Mis en
 * cache 10 min — le proxy le demande à chaque report de lecture.
 */
export async function jellyfinTokenOwner(token: string): Promise<string | null | undefined> {
  const key = hashToken(token);
  const hit = ownerCache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.userId;
  const jellyfinUrl = getJellyfinUrl();
  if (!jellyfinUrl) return undefined;
  try {
    const res = await fetch(`${jellyfinUrl}/Users/Me`, {
      headers: jellyfinAuthHeaders(token),
      signal: AbortSignal.timeout(3000),
    });
    if (res.status === 401 || res.status === 403) {
      ownerCache.delete(key);
      return null;
    }
    if (!res.ok) return undefined;
    const data = (await res.json()) as { Id?: unknown };
    if (typeof data?.Id !== "string" || !data.Id) return undefined;
    if (ownerCache.size >= OWNER_CACHE_MAX) {
      const now = Date.now();
      for (const [k, v] of ownerCache) if (v.expiresAt <= now) ownerCache.delete(k);
      if (ownerCache.size >= OWNER_CACHE_MAX) ownerCache.clear();
    }
    ownerCache.set(key, { userId: data.Id, expiresAt: Date.now() + OWNER_TTL_MS });
    return data.Id;
  } catch {
    return undefined;
  }
}

export async function tokenOwnership(token: string, jellyfinUserId: string): Promise<TokenOwnership> {
  const owner = await jellyfinTokenOwner(token);
  if (owner === null) return "invalid";
  if (owner === undefined) return "unknown";
  return sameJellyfinId(owner, jellyfinUserId) ? "own" : "foreign";
}

/** Oublie le jeton stocké d'un appareil (invalide, ou d'un autre compte). */
async function clearStoredToken(tokenHash: string): Promise<void> {
  await getPrisma()
    .pairedDevice.update({ where: { tokenHash }, data: { jellyfinAccessToken: null } })
    .catch(() => {});
}

/**
 * Le jeton Jellyfin au nom duquel parler pour un appareil jumelé — la seule
 * porte d'entrée : config du direct, proxy de lecture, canal de session.
 *
 * Son jeton PROPRE (`jellyfinDeviceId` renseigné) s'il appartient bien à son
 * compte — ou si Jellyfin ne répond pas : rien ne permet alors de le
 * condamner. Sinon, un jeton est frappé pour lui (`deviceJellyfinToken.ts`) :
 * jumelage d'avant, dont le jeton était la copie de celui d'un autre appareil
 * du compte (jamais rendu, et retiré de la base au passage), frappe ratée, ou
 * jeton supprimé chez Jellyfin. `null` : révoqué, ou pas de jeton possible
 * (Quick Connect coupé, Jellyfin injoignable) — la TV passe par le proxy.
 *
 * Plus aucune greffe : le jeton d'un appareil frère n'est jamais rendu à un
 * autre. Le partager rendait toute révocation impossible sans déconnecter le
 * frère.
 */
export async function resolvePairedDeviceToken(deviceJwt: string, jellyfinUserId: string): Promise<string | null> {
  if (!hasPrisma()) return null;
  const tokenHash = hashToken(deviceJwt);
  const row = await getPrisma()
    .pairedDevice.findUnique({
      where: { tokenHash },
      select: { name: true, jellyfinAccessToken: true, jellyfinDeviceId: true },
    })
    .catch(() => undefined);
  // Base indisponible, ou jumelage révoqué : rien à rendre.
  if (!row) return null;
  if (row.jellyfinDeviceId && row.jellyfinAccessToken) {
    const ownership = await tokenOwnership(row.jellyfinAccessToken, jellyfinUserId);
    if (ownership === "own" || ownership === "unknown") return row.jellyfinAccessToken;
  }
  if (row.jellyfinAccessToken) await clearStoredToken(tokenHash);
  return ensureOwnJellyfinToken(tokenHash, { jellyfinUserId, name: row.name });
}

/** Le jeton Jellyfin d'un appareil révoqué : la réponse en cache de son
 *  propriétaire n'est plus une preuve. */
export function forgetJellyfinTokenOwner(token: string): void {
  ownerCache.delete(hashToken(token));
}

/**
 * Valide le token Jellyfin stocké d'un device et le PURGE de la base s'il est
 * EXPLICITEMENT invalide (401/403) ou porté par un autre compte. Un 5xx / 404 /
 * timeout NE purge PAS (token probablement valide, erreur transitoire) — sinon
 * le device perdrait l'attribution de lecture sans moyen de la reprovisionner
 * hors re-jumelage.
 *
 * Le proxy de lecture l'appelle en auto-réparation quand un report
 * `/Sessions/Playing*` prend un 401 avec le token device — sinon il réutilisait
 * un token périmé en boucle (spam de 401 fire-and-forget). Renvoie `true` si le
 * token a été purgé.
 */
export async function clearDeviceTokenIfInvalid(bearerToken: string): Promise<boolean> {
  if (!hasPrisma() || !getJellyfinUrl()) return false;

  const tokenHash = hashToken(bearerToken);
  if (inFlight.has(tokenHash)) return false;
  inFlight.add(tokenHash);
  try {
    const device = await getPrisma().pairedDevice
      .findUnique({ where: { tokenHash }, select: { jellyfinAccessToken: true, jellyfinUserId: true } })
      .catch(() => null);
    const jfToken = device?.jellyfinAccessToken;
    if (!jfToken || !device) return false;
    // Un 401 vient d'être reçu : la réponse en cache n'est plus une preuve.
    ownerCache.delete(hashToken(jfToken));
    const ownership = await tokenOwnership(jfToken, device.jellyfinUserId);
    if (ownership === "invalid" || ownership === "foreign") {
      await clearStoredToken(tokenHash);
      return true;
    }
    return false;
  } finally {
    inFlight.delete(tokenHash);
  }
}

/** Tests uniquement : repart d'un cache de propriété vide. */
export function resetTokenOwnerCacheForTests(): void {
  ownerCache.clear();
}
