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
