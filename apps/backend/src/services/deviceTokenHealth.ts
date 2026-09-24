import { getPrisma, hasPrisma } from "./db";
import { hashToken } from "./jwt";
import { getJellyfinUrl } from "./configStore";

/**
 * Le jeton Jellyfin d'un appareil jumelé : à qui il appartient, et lequel
 * utiliser.
 *
 * Un appareil jumelé (TV, LG, provisioning) ne s'authentifie jamais auprès de
 * Jellyfin : il reçoit, en base, une COPIE du jeton d'un autre appareil du
 * même compte. Tout ce qui parle à Jellyfin en son nom — lecture directe,
 * reports de lecture du proxy, canal de session — passe par ce jeton, et
 * Jellyfin attribue au PORTEUR du jeton, pas à l'utilisateur de l'URL.
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

/** Un JWT Tentacle (trois segments) n'est pas un jeton Jellyfin (hexadécimal opaque). */
export function looksLikeJwt(token: string): boolean {
  return token.split(".").length === 3;
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
      headers: { "X-Emby-Token": token },
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
 * Cherche le token Jellyfin VALIDE le plus récent parmi les appareils jumelés
 * du même utilisateur (« sibling ») — self-healing quand un device n'a pas (ou
 * plus) de token propre : confirmé depuis une session JWT, ou token purgé sur
 * 401. Chaque candidat doit appartenir au compte : un sibling mort ou étranger
 * est purgé au passage. `regraftTokenHash` fourni → le token trouvé est
 * RE-GRAVÉ sur ce device : les appels suivants (config/streaming, routes de
 * session du proxy) le trouvent directement, et la TV qui « redemande un
 * token » repart sans re-jumelage.
 */
export async function findValidSiblingToken(
  jellyfinUserId: string,
  opts: { excludeTokenHash?: string; regraftTokenHash?: string } = {},
): Promise<string | null> {
  if (!hasPrisma() || !getJellyfinUrl()) return null;
  const prisma = getPrisma();
  try {
    const siblings = await prisma.pairedDevice.findMany({
      where: {
        jellyfinUserId,
        jellyfinAccessToken: { not: null },
        ...(opts.excludeTokenHash && { tokenHash: { not: opts.excludeTokenHash } }),
      },
      orderBy: { lastSeen: "desc" },
      select: { tokenHash: true, jellyfinAccessToken: true },
      take: 5,
    });
    for (const sibling of siblings) {
      const token = sibling.jellyfinAccessToken!;
      const ownership = await tokenOwnership(token, jellyfinUserId);
      if (ownership === "own") {
        if (opts.regraftTokenHash) {
          await prisma.pairedDevice
            .update({ where: { tokenHash: opts.regraftTokenHash }, data: { jellyfinAccessToken: token } })
            .catch(() => {});
        }
        return token;
      }
      // Jellyfin injoignable → inutile d'insister sur les suivants.
      if (ownership === "unknown") return null;
      // Mort (401/403) ou porté par un autre compte : purgé, et suivant.
      await clearStoredToken(sibling.tokenHash);
    }
  } catch { /* DB indisponible → pas de self-healing */ }
  return null;
}

/**
 * Le jeton Jellyfin au nom duquel parler pour un appareil jumelé — la seule
 * porte d'entrée : config du direct, proxy de lecture, canal de session.
 *
 * Le jeton stocké s'il appartient au compte (ou si Jellyfin ne répond pas :
 * rien ne permet alors de le condamner) ; sinon il est purgé et un sibling du
 * même compte prend sa place. `purged` dit qu'un jeton a été retiré sans
 * remplaçant — le client doit oublier celui qu'il tenait.
 */
export async function resolvePairedDeviceToken(
  deviceJwt: string,
  jellyfinUserId: string,
): Promise<{ token: string | null; purged: boolean }> {
  if (!hasPrisma()) return { token: null, purged: false };
  const tokenHash = hashToken(deviceJwt);
  const row = await getPrisma()
    .pairedDevice.findUnique({ where: { tokenHash }, select: { jellyfinAccessToken: true } })
    .then((found) => ({ found }), () => null);
  // Base indisponible : rien à rendre, rien à purger.
  if (!row) return { token: null, purged: false };
  const stored = row.found?.jellyfinAccessToken ?? null;
  let purged = false;
  if (stored) {
    const ownership = await tokenOwnership(stored, jellyfinUserId);
    if (ownership === "own" || ownership === "unknown") return { token: stored, purged };
    await clearStoredToken(tokenHash);
    purged = true;
  }
  const sibling = await findValidSiblingToken(jellyfinUserId, {
    excludeTokenHash: tokenHash,
    regraftTokenHash: tokenHash,
  });
  return { token: sibling, purged: purged && !sibling };
}

/**
 * Le jeton Jellyfin à graver sur un appareil qu'on jumelle. Celui de la
 * requête du confirmateur — lu à la MÊME source que son authentification
 * (`getTokenFromRequest`) — s'il est un jeton Jellyfin de son propre compte ;
 * sinon le dernier jeton valide d'un autre appareil du compte.
 */
export async function confirmerJellyfinToken(
  requestToken: string | null,
  jellyfinUserId: string,
): Promise<string | null> {
  if (requestToken && !looksLikeJwt(requestToken)
    && (await tokenOwnership(requestToken, jellyfinUserId)) === "own") {
    return requestToken;
  }
  return findValidSiblingToken(jellyfinUserId);
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
