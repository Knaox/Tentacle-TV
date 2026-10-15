import { jellyfinAdminFetch } from "../jellyfinAdminFetch";
import { onContentPolicyInvalidated } from "../contentPolicy";
import { normalizeJellyfinId } from "../../userRights/userRightsPatch";

/**
 * Le droit « Partage public » d'un compte — `EnablePublicSharing` de SA
 * politique Jellyfin, qui fait foi (docs/DROITS-UTILISATEURS.md § 9.3). Il
 * garde TOUT lien public (`share_links` : Ma liste, favoris, statistiques).
 * Sans lui, le compte ne crée aucun lien de partage, et ceux qu'il a déjà ne
 * servent plus rien (« lien indisponible ») ; ils reviennent avec le droit.
 *
 * Relu par la clé d'administration (`GET /Users/{id}`) : un lien s'ouvre sans
 * compte, le propriétaire n'est pas là pour prêter son jeton. Gardé 30 s,
 * oublié à toute écriture de politique faite par Tentacle. FERMÉ À L'ÉCHEC :
 * Jellyfin muet, compte inconnu → pas de partage (gardé 5 s seulement).
 */

/** Les refus, tels que les routes de partage les rendent (403). */
export const PUBLIC_SHARING_DENIED = { error: "public_sharing_denied", message: "Partage public non autorisé" } as const;
export const SHARE_UNAVAILABLE = { error: "share_unavailable", message: "Lien indisponible" } as const;

const TTL_MS = 30_000;
const CLOSED_TTL_MS = 5_000;
const MAX_ENTRIES = 500;

const cache = new Map<string, { allowed: boolean; expiresAt: number }>();
const inflight = new Map<string, Promise<boolean>>();

// Une lecture en cours pendant l'écriture rendrait l'état d'avant : elle n'est pas gardée.
onContentPolicyInvalidated((userId) => {
  if (userId === null) {
    cache.clear();
    inflight.clear();
    return;
  }
  const key = normalizeJellyfinId(userId);
  cache.delete(key);
  inflight.delete(key);
});

async function readRight(userId: string): Promise<{ allowed: boolean; readable: boolean }> {
  if (!/^[0-9a-fA-F-]{32,36}$/.test(userId)) return { allowed: false, readable: true };
  const result = await jellyfinAdminFetch<{ Policy?: Record<string, unknown> }>(`/Users/${encodeURIComponent(userId)}`);
  if (!result.ok || !result.data?.Policy || typeof result.data.Policy !== "object") return { allowed: false, readable: false };
  return { allowed: result.data.Policy.EnablePublicSharing === true, readable: true };
}

/** Ce compte peut-il partager en public ? Jamais une exception. */
export async function mayShareInPublic(userId: string): Promise<boolean> {
  const key = normalizeJellyfinId(userId);
  const cached = cache.get(key);
  if (cached && Date.now() < cached.expiresAt) return cached.allowed;
  const running = inflight.get(key);
  if (running) return running;
  const pending = readRight(userId)
    .catch(() => ({ allowed: false, readable: false }))
    .then(({ allowed, readable }) => {
      if (inflight.get(key) === pending) {
        inflight.delete(key);
        cache.set(key, { allowed, expiresAt: Date.now() + (readable ? TTL_MS : CLOSED_TTL_MS) });
        if (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value as string);
      }
      return allowed;
    });
  inflight.set(key, pending);
  return pending;
}

/** Tests. */
export function clearPublicSharingRightCache(): void {
  cache.clear();
  inflight.clear();
}
