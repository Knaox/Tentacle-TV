import { jellyfinAdminFetch } from "../jellyfinAdminFetch";

/**
 * Deux réglages du SERVEUR Jellyfin qui décident du plafond des clients
 * distants (docs/DROITS-UTILISATEURS.md § 9.2), relus par la clé
 * d'administration, gardés cinq minutes (ils ne bougent presque jamais) :
 *
 * - `RemoteClientBitrateLimit` (`/System/Configuration`) : le plafond de tous
 *   les comptes qui n'en ont pas à eux (0 = aucun) ;
 * - `LocalNetworkSubnets` (`/System/Configuration/network`) : ce que Jellyfin
 *   tient pour le réseau local (vide = les réseaux privés).
 *
 * Illisibles : aucun plafond du serveur, et les réseaux privés — la règle par
 * défaut de Jellyfin.
 */

const TTL_MS = 5 * 60_000;

interface Cached<T> {
  value: T;
  expiresAt: number;
}

let limitCache: Cached<number> | null = null;
let subnetsCache: Cached<string[]> | null = null;

/** Le plafond de débit des clients distants réglé pour tout le serveur (bits/s, 0 = aucun). */
export async function serverRemoteBitrateLimit(): Promise<number> {
  if (limitCache && Date.now() < limitCache.expiresAt) return limitCache.value;
  const result = await jellyfinAdminFetch<{ RemoteClientBitrateLimit?: unknown }>("/System/Configuration");
  const raw = result.ok ? result.data?.RemoteClientBitrateLimit : 0;
  const value = typeof raw === "number" && Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0;
  limitCache = { value, expiresAt: Date.now() + TTL_MS };
  return value;
}

/** Les réseaux locaux déclarés à Jellyfin (vide : les réseaux privés). */
export async function jellyfinLocalSubnets(): Promise<string[]> {
  if (subnetsCache && Date.now() < subnetsCache.expiresAt) return subnetsCache.value;
  const result = await jellyfinAdminFetch<{ LocalNetworkSubnets?: unknown }>("/System/Configuration/network");
  const raw = result.ok ? result.data?.LocalNetworkSubnets : [];
  const value = Array.isArray(raw) ? raw.filter((entry): entry is string => typeof entry === "string" && entry.trim() !== "") : [];
  subnetsCache = { value, expiresAt: Date.now() + TTL_MS };
  return value;
}

/** Tests. */
export function resetServerNetworkCache(): void {
  limitCache = null;
  subnetsCache = null;
}
