import type { JellyfinUser } from "../../middleware/auth";
import { userRights } from "./host/userRights";

/**
 * Un compte peut-il se servir d'une extension ISOLÉE ? Sans ce droit, il ne
 * reçoit RIEN d'elle : ni son entrée dans `/api/plugins/active` (navigation,
 * contrat `music` compris), ni son bundle, ni ses routes (le relais répond 403
 * sans contacter l'invité).
 *
 * - Un administrateur en session PERSONNELLE passe toujours : c'est lui qui
 *   règle l'extension (sa page d'administration est dans son bundle), même
 *   quand l'intégration est encore éteinte ou sans bibliothèque musique.
 * - Les autres : `users.rights` → `canUse` (Jellyfin, Famille, intégration
 *   allumée), relu au plus une fois par minute et par compte. Une erreur vaut
 *   refus (fermé à l'échec).
 */

const TTL_MS = 60_000;
const cache = new Map<string, { allowed: boolean; at: number }>();

export async function mayUseIsolatedPlugin(pluginId: string, user: Pick<JellyfinUser, "userId" | "isAdmin" | "session">, now = Date.now()): Promise<boolean> {
  if (user.isAdmin && user.session === "personal") return true;
  const key = `${pluginId}:${user.userId}`;
  const hit = cache.get(key);
  if (hit && now - hit.at < TTL_MS) return hit.allowed;
  let allowed: boolean;
  try {
    allowed = (await userRights(pluginId, user.userId)).canUse;
  } catch {
    allowed = false;
  }
  cache.set(key, { allowed, at: now });
  if (cache.size > 2_000) cache.clear();
  return allowed;
}

/** L'extension a changé (activée, réglée, coupée) : les droits se relisent à la prochaine requête. */
export function forgetIsolatedRights(pluginId?: string): void {
  if (!pluginId) return cache.clear();
  for (const key of cache.keys()) if (key.startsWith(`${pluginId}:`)) cache.delete(key);
}
