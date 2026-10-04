import { getJellyfinApiKey, getJellyfinUrl } from "../configStore";
import { jellyfinAuthHeaders } from "../jellyfinAuth";

/**
 * Watch Together — cache court des utilisateurs Jellyfin (clé API admin).
 * Évite de marteler Jellyfin quand la liste des invitables est rafraîchie ou
 * que le roomStore résout le profil d'un membre (username/avatar).
 */

export interface CachedJellyfinUser {
  id: string;
  name: string;
  hasAvatar: boolean;
  isDisabled: boolean;
  isAdministrator: boolean;
  /** Caché de l'écran de connexion de Jellyfin (la Famille n'en fait jamais un candidat listé). */
  isHidden: boolean;
  /** L'avatar (`PrimaryImageTag`), pour l'adresser par contenu. */
  imageTag: string | null;
}

interface JellyfinUserDto {
  Id: string;
  Name: string;
  PrimaryImageTag?: string;
  Policy?: { IsAdministrator?: boolean; IsDisabled?: boolean; IsHidden?: boolean };
}

const TTL_MS = 30_000;
let cache: { users: CachedJellyfinUser[]; at: number } | null = null;
let pending: Promise<CachedJellyfinUser[] | null> | null = null;

async function fetchUsers(): Promise<CachedJellyfinUser[] | null> {
  const jellyfinUrl = getJellyfinUrl();
  const apiKey = getJellyfinApiKey();
  if (!jellyfinUrl || !apiKey) return null;
  try {
    const res = await fetch(`${jellyfinUrl}/Users`, {
      headers: jellyfinAuthHeaders(apiKey),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const users = (await res.json()) as JellyfinUserDto[];
    return users.map((u) => ({
      id: u.Id,
      name: u.Name,
      hasAvatar: !!u.PrimaryImageTag,
      isDisabled: u.Policy?.IsDisabled === true,
      isAdministrator: u.Policy?.IsAdministrator === true,
      isHidden: u.Policy?.IsHidden === true,
      imageTag: u.PrimaryImageTag ?? null,
    }));
  } catch {
    return null;
  }
}

/** Liste des utilisateurs Jellyfin (cache 30 s, requêtes concurrentes fusionnées).
 *  Renvoie null si Jellyfin est injoignable ET qu'aucun cache n'existe. */
export async function getJellyfinUsers(): Promise<CachedJellyfinUser[] | null> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.users;
  if (!pending) {
    pending = fetchUsers().finally(() => {
      pending = null;
    });
  }
  const users = await pending;
  if (users) cache = { users, at: Date.now() };
  return users ?? cache?.users ?? null;
}

/** Oublie la liste : un compte vient d'être créé ou supprimé (invité de la Famille). */
export function invalidateJellyfinUsers(): void {
  cache = null;
}

/** Profil minimal d'un utilisateur (username/avatar) — pour peupler les membres. */
export async function getUserBasic(userId: string): Promise<{ name: string; hasAvatar: boolean } | null> {
  const users = await getJellyfinUsers();
  const u = users?.find((x) => x.id === userId);
  return u ? { name: u.name, hasAvatar: u.hasAvatar } : null;
}
