/**
 * Lecture des droits Jellyfin liés aux téléchargements — SOURCE DE VÉRITÉ
 * UNIQUE : la UserPolicy Jellyfin, relue en direct avec le token de
 * l'utilisateur lui-même (`GET /Users/Me`, qui renvoie la Policy complète).
 * Aucune copie persistée côté Tentacle ; cache mémoire court (30 s) seulement.
 *
 * Sémantique vérifiée (source Jellyfin v10.11.11) :
 * - `EnableContentDownloading` gate le vrai endpoint /Items/{id}/Download
 *   (double enforcement : Jellyfin revérifie derrière notre garde) ;
 * - `EnableMediaConversion` n'est appliqué NULLE PART par Jellyfin (vestige
 *   Emby « Convert media ») → c'est ICI que le mode Allégé l'applique ;
 * - périmètre bibliothèques : `BlockedMediaFolders` (blacklist) PRIORITAIRE,
 *   puis `EnableAllFolders`, sinon whitelist `EnabledFolders`. Les GUIDs sont
 *   ceux des CollectionFolder de premier niveau — comparaison NORMALISÉE
 *   (Jellyfin mélange formes avec et sans tirets selon les endpoints).
 *
 * Échec de lecture (Jellyfin injoignable, token non-Jellyfin type JWT
 * d'impersonation/device) → refus (fail-closed) : aucune capacité.
 */

import { getJellyfinUrl } from "./configStore";
import { BACKEND_VERSION } from "./version";

export interface DownloadPolicySnapshot {
  enableContentDownloading: boolean;
  enableMediaConversion: boolean;
  enableVideoPlaybackTranscoding: boolean;
  enableAudioPlaybackTranscoding: boolean;
  enablePlaybackRemuxing: boolean;
  enableAllFolders: boolean;
  /** GUIDs normalisés (minuscules, sans tirets). */
  enabledFolders: string[];
  blockedMediaFolders: string[];
}

export interface DownloadCapabilities {
  downloads: boolean;
  lightDownloads: boolean;
}

const POLICY_TTL_MS = 30_000;
const FETCH_TIMEOUT_MS = 5_000;
const policyCache = new Map<string, { policy: DownloadPolicySnapshot | null; expiresAt: number }>();

export function normalizeGuid(id: string): string {
  return id.replace(/-/g, "").toLowerCase();
}

/** Schéma d'auth pérenne (les X-Emby-* sont dépréciés depuis JF 10.11). */
export function mediaBrowserAuthHeader(token: string): string {
  return `MediaBrowser Token="${token}", Client="Tentacle Server", Device="Tentacle Backend", DeviceId="tentacle-backend", Version="${BACKEND_VERSION}"`;
}

/** Vide le cache (tests). */
export function clearPolicyCache(): void {
  policyCache.clear();
}

export async function getUserDownloadPolicy(
  token: string,
): Promise<DownloadPolicySnapshot | null> {
  const cached = policyCache.get(token);
  if (cached && Date.now() < cached.expiresAt) return cached.policy;

  const jellyfinUrl = getJellyfinUrl();
  if (!jellyfinUrl) return null;

  let policy: DownloadPolicySnapshot | null = null;
  try {
    const res = await fetch(`${jellyfinUrl}/Users/Me`, {
      headers: { Authorization: mediaBrowserAuthHeader(token) },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (res.ok) {
      const data = (await res.json()) as {
        Policy?: Record<string, unknown>;
      };
      const p = data.Policy ?? {};
      const guidList = (value: unknown): string[] =>
        Array.isArray(value)
          ? value.filter((v): v is string => typeof v === "string").map(normalizeGuid)
          : [];
      policy = {
        enableContentDownloading: p.EnableContentDownloading === true,
        enableMediaConversion: p.EnableMediaConversion === true,
        enableVideoPlaybackTranscoding: p.EnableVideoPlaybackTranscoding === true,
        enableAudioPlaybackTranscoding: p.EnableAudioPlaybackTranscoding === true,
        enablePlaybackRemuxing: p.EnablePlaybackRemuxing === true,
        enableAllFolders: p.EnableAllFolders === true,
        enabledFolders: guidList(p.EnabledFolders),
        blockedMediaFolders: guidList(p.BlockedMediaFolders),
      };
    }
  } catch {
    policy = null;
  }

  policyCache.set(token, { policy, expiresAt: Date.now() + POLICY_TTL_MS });
  if (policyCache.size > 200) {
    const now = Date.now();
    for (const [key, entry] of policyCache) {
      if (now > entry.expiresAt) policyCache.delete(key);
    }
  }
  return policy;
}

export function capabilitiesFromPolicy(
  policy: DownloadPolicySnapshot | null,
): DownloadCapabilities {
  if (!policy || !policy.enableContentDownloading) {
    return { downloads: false, lightDownloads: false };
  }
  const canTranscode =
    policy.enableVideoPlaybackTranscoding || policy.enablePlaybackRemuxing;
  return {
    downloads: true,
    lightDownloads: policy.enableMediaConversion && canTranscode,
  };
}

export async function getDownloadCapabilities(token: string): Promise<DownloadCapabilities> {
  return capabilitiesFromPolicy(await getUserDownloadPolicy(token));
}

/**
 * Bibliothèque (CollectionFolder de premier niveau) d'un item, via
 * `/Items/{id}/Ancestors` AVEC LE TOKEN DE L'UTILISATEUR — un item invisible
 * pour lui (contrôle parental, dossier bloqué) répond déjà 404 côté Jellyfin.
 */
export async function getItemLibraryId(token: string, itemId: string): Promise<string | null> {
  const jellyfinUrl = getJellyfinUrl();
  if (!jellyfinUrl) return null;
  try {
    const res = await fetch(`${jellyfinUrl}/Items/${itemId}/Ancestors`, {
      headers: { Authorization: mediaBrowserAuthHeader(token) },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const ancestors = (await res.json()) as Array<{ Id?: string; Type?: string }>;
    if (!Array.isArray(ancestors) || ancestors.length === 0) return null;
    // Ordre : parent direct → racine. Le dernier CollectionFolder est la
    // bibliothèque ; à défaut, le dernier ancêtre.
    for (let i = ancestors.length - 1; i >= 0; i--) {
      if (ancestors[i]?.Type === "CollectionFolder" && ancestors[i]?.Id) {
        return normalizeGuid(ancestors[i].Id as string);
      }
    }
    const last = ancestors[ancestors.length - 1];
    return last?.Id ? normalizeGuid(last.Id) : null;
  } catch {
    return null;
  }
}

/** Blacklist prioritaire → accès global → whitelist. `libraryId` normalisé. */
export function isLibraryAllowed(policy: DownloadPolicySnapshot, libraryId: string): boolean {
  if (policy.blockedMediaFolders.includes(libraryId)) return false;
  if (policy.enableAllFolders) return true;
  return policy.enabledFolders.includes(libraryId);
}

export async function checkDownloadRight(token: string, itemId: string): Promise<boolean> {
  const policy = await getUserDownloadPolicy(token);
  if (!policy || !policy.enableContentDownloading) return false;
  const libraryId = await getItemLibraryId(token, itemId);
  if (!libraryId) return false;
  return isLibraryAllowed(policy, libraryId);
}

export async function checkLightRight(token: string, itemId: string): Promise<boolean> {
  const policy = await getUserDownloadPolicy(token);
  if (!capabilitiesFromPolicy(policy).lightDownloads) return false;
  return checkDownloadRight(token, itemId);
}
