/**
 * Écriture des droits de téléchargement dans Jellyfin (admin).
 *
 * ⚠️ `POST /Users/{id}/Policy` est un REMPLACEMENT INTÉGRAL (vérifié source
 * v10.11.11 : chaque champ du DTO est réécrit, un champ absent retombe au
 * défaut — jusqu'au crash 500 si AuthenticationProviderId manque, issues
 * jellyfin#10552/#10417 « not planned »). Règle absolue ici : GET de la
 * policy COMPLÈTE → merge des seuls champs modifiés → POST de l'objet entier,
 * puis RELECTURE de vérification. Aucune copie locale : Jellyfin fait foi.
 *
 * Auth : clé API serveur (rôle Administrator automatique côté Jellyfin).
 */

import { getJellyfinApiKey, getJellyfinUrl } from "./configStore";
import { mediaBrowserAuthHeader } from "./jellyfinPolicy";

const TIMEOUT_MS = 8_000;

export interface AdminUserRights {
  id: string;
  name: string;
  isAdministrator: boolean;
  enableContentDownloading: boolean;
  enableMediaConversion: boolean;
  enableAllFolders: boolean;
  enabledFoldersCount: number;
}

export interface RightsPatch {
  enableContentDownloading?: boolean;
  enableMediaConversion?: boolean;
}

function adminContext(): { url: string; headers: Record<string, string> } {
  const url = getJellyfinUrl();
  const apiKey = getJellyfinApiKey();
  if (!url) throw new Error("jellyfin-not-configured");
  if (!apiKey) throw new Error("admin-key-missing");
  return { url, headers: { Authorization: mediaBrowserAuthHeader(apiKey) } };
}

interface JellyfinUserDto {
  Id?: string;
  Name?: string;
  Policy?: Record<string, unknown> & {
    IsAdministrator?: boolean;
    EnableContentDownloading?: boolean;
    EnableMediaConversion?: boolean;
    EnableAllFolders?: boolean;
    EnabledFolders?: unknown[];
  };
}

function toRights(dto: JellyfinUserDto): AdminUserRights {
  const policy = dto.Policy ?? {};
  return {
    id: dto.Id ?? "",
    name: dto.Name ?? "",
    isAdministrator: policy.IsAdministrator === true,
    enableContentDownloading: policy.EnableContentDownloading === true,
    enableMediaConversion: policy.EnableMediaConversion === true,
    enableAllFolders: policy.EnableAllFolders === true,
    enabledFoldersCount: Array.isArray(policy.EnabledFolders) ? policy.EnabledFolders.length : 0,
  };
}

export async function listUsersRights(): Promise<AdminUserRights[]> {
  const { url, headers } = adminContext();
  const res = await fetch(`${url}/Users`, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error("jellyfin-unreachable");
  const users = (await res.json()) as JellyfinUserDto[];
  return users
    .filter((user) => !!user.Id)
    .map(toRights)
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function fetchUser(url: string, headers: Record<string, string>, userId: string): Promise<JellyfinUserDto> {
  const res = await fetch(`${url}/Users/${userId}`, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (res.status === 404) throw new Error("user-not-found");
  if (!res.ok) throw new Error("jellyfin-unreachable");
  return (await res.json()) as JellyfinUserDto;
}

/** Applique le patch et renvoie les droits RELUS depuis Jellyfin. */
export async function updateUserRights(userId: string, patch: RightsPatch): Promise<AdminUserRights> {
  const { url, headers } = adminContext();
  const dto = await fetchUser(url, headers, userId);
  const policy = dto.Policy;
  if (!policy || typeof policy !== "object") throw new Error("policy-missing");

  const merged: Record<string, unknown> = { ...policy };
  if (patch.enableContentDownloading !== undefined) {
    merged.EnableContentDownloading = patch.enableContentDownloading;
  }
  if (patch.enableMediaConversion !== undefined) {
    merged.EnableMediaConversion = patch.enableMediaConversion;
  }

  const post = await fetch(`${url}/Users/${userId}/Policy`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(merged),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!post.ok) throw new Error("update-failed");

  // Relecture de vérification : Jellyfin fait foi, on renvoie CE qu'il a retenu.
  const reread = toRights(await fetchUser(url, headers, userId));
  const downloadOk =
    patch.enableContentDownloading === undefined ||
    reread.enableContentDownloading === patch.enableContentDownloading;
  const conversionOk =
    patch.enableMediaConversion === undefined ||
    reread.enableMediaConversion === patch.enableMediaConversion;
  if (!downloadOk || !conversionOk) throw new Error("verify-failed");
  return reread;
}
