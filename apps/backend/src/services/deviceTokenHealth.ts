import { getPrisma, hasPrisma } from "./db";
import { hashToken } from "./jwt";
import { getJellyfinUrl } from "./configStore";

/** Évite de relancer N validations /Users/Me concurrentes pour le même device
 *  (les reports de progression arrivent en rafale). Clé = tokenHash. */
const inFlight = new Set<string>();

/**
 * Valide le token Jellyfin stocké d'un device contre `/Users/Me` et le PURGE de
 * la base s'il est EXPLICITEMENT invalide (401/403). Un 5xx / 404 / timeout NE
 * purge PAS (token probablement valide, erreur transitoire) — sinon le device
 * perdrait l'attribution de lecture sans moyen de la reprovisionner hors re-jumelage.
 *
 * Mutualisé : `routes/config.ts` valide ainsi au démarrage ; le proxy de lecture
 * l'appelle en auto-réparation quand un report `/Sessions/Playing*` prend un 401
 * avec le token device — sinon le proxy réutilisait un token périmé en boucle
 * (spam de 401 fire-and-forget). Renvoie `true` si le token a été purgé.
 */
/**
 * Cherche le token Jellyfin VALIDE le plus récent parmi les appareils jumelés
 * du même utilisateur (« sibling ») — self-healing quand un device n'a pas (ou
 * plus) de token propre : confirmé depuis une session JWT, ou token purgé sur
 * 401. Chaque candidat est validé contre `/Users/Me` (un sibling mort est
 * purgé au passage, même politique que clearDeviceTokenIfInvalid).
 * `regraftTokenHash` fourni → le token trouvé est RE-GRAVÉ sur ce device : les
 * appels suivants (config/streaming, routes de session du proxy) le trouvent
 * directement, et la TV qui « redemande un token » repart sans re-jumelage.
 */
export async function findValidSiblingToken(
  jellyfinUserId: string,
  opts: { excludeTokenHash?: string; regraftTokenHash?: string } = {},
): Promise<string | null> {
  if (!hasPrisma()) return null;
  const jellyfinUrl = getJellyfinUrl();
  if (!jellyfinUrl) return null;
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
      try {
        const check = await fetch(`${jellyfinUrl}/Users/Me`, {
          headers: { "X-Emby-Token": token },
          signal: AbortSignal.timeout(3000),
        });
        if (check.ok) {
          if (opts.regraftTokenHash) {
            await prisma.pairedDevice
              .update({ where: { tokenHash: opts.regraftTokenHash }, data: { jellyfinAccessToken: token } })
              .catch(() => {});
          }
          return token;
        }
        if (check.status === 401 || check.status === 403) {
          // Sibling mort : purge (401/403 explicite uniquement) et suivant.
          await prisma.pairedDevice
            .update({ where: { tokenHash: sibling.tokenHash }, data: { jellyfinAccessToken: null } })
            .catch(() => {});
        }
      } catch {
        return null; // Jellyfin injoignable → inutile d'insister
      }
    }
  } catch { /* DB indisponible → pas de self-healing */ }
  return null;
}

export async function clearDeviceTokenIfInvalid(bearerToken: string): Promise<boolean> {
  if (!hasPrisma()) return false;
  const jellyfinUrl = getJellyfinUrl();
  if (!jellyfinUrl) return false;

  const tokenHash = hashToken(bearerToken);
  if (inFlight.has(tokenHash)) return false;
  inFlight.add(tokenHash);
  try {
    const prisma = getPrisma();
    const device = await prisma.pairedDevice
      .findUnique({ where: { tokenHash }, select: { jellyfinAccessToken: true } })
      .catch(() => null);
    const jfToken = device?.jellyfinAccessToken;
    if (!jfToken) return false;

    const check = await fetch(`${jellyfinUrl}/Users/Me`, {
      headers: { "X-Emby-Token": jfToken },
      signal: AbortSignal.timeout(3000),
    });
    if (check.status === 401 || check.status === 403) {
      await prisma.pairedDevice
        .update({ where: { tokenHash }, data: { jellyfinAccessToken: null } })
        .catch(() => {});
      return true;
    }
    return false;
  } catch {
    return false; // Jellyfin injoignable → garder le token
  } finally {
    inFlight.delete(tokenHash);
  }
}
