/**
 * Le profil de connexion gardé dans `tentacle_user` — le DTO Jellyfin rendu
 * au login — et sa relecture.
 *
 * Il n'était écrit qu'à la connexion : une photo changée depuis le web,
 * ajoutée après coup ou retirée restait celle du jour du login, et l'étiquette
 * figée dans l'URL faisait resservir l'ancienne image par le cache disque.
 * Il se relit désormais, et ceux qui l'affichent s'y abonnent.
 *
 * Module PUR (ni React Native ni Expo) : testé sous vitest.
 */

import type { StorageAdapter } from "@tentacle-tv/api-client";

export const STORED_USER_KEY = "tentacle_user";

export interface StoredUser {
  Id: string;
  Name?: string;
  PrimaryImageTag?: string | null;
  Policy?: { IsAdministrator?: boolean; [field: string]: unknown };
  [field: string]: unknown;
}

type ProfileStorage = Pick<StorageAdapter, "getItem" | "setItem">;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isUser = (value: unknown): value is StoredUser =>
  isRecord(value) && typeof value.Id === "string" && value.Id !== "";

/** Le profil d'une valeur stockée, ou `null` (absente, illisible, sans `Id`). */
export function parseStoredUser(raw: string | null): StoredUser | null {
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isUser(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Ce que devient le profil stocké après une relecture, ou `null` s'il n'y a
 * rien à écrire : réponse illisible, autre compte, ou aucun profil à
 * rafraîchir — seule la connexion en crée un.
 *
 * - DTO COMPLET (`/Users/Me`, qui porte toujours `Policy` et
 *   `Configuration`) : il remplace l'ancien. Une étiquette absente veut dire
 *   que la photo a été retirée ; la garder ferait resservir l'ancienne. Les
 *   droits connus restent si, par exception, la réponse n'en porte pas.
 * - DTO PARTIEL (le `{ Id, Name }` que `POST /api/auth/refresh` rend pour un
 *   jeton d'appareil ou d'usurpation) : seul le nom est repris. Il ne dit
 *   rien de la photo ni des droits, qui ne s'écrasent donc pas.
 */
export function mergeFreshUser(stored: StoredUser | null, fresh: unknown): StoredUser | null {
  if (stored === null || !isUser(fresh) || fresh.Id !== stored.Id) return null;
  if (isRecord(fresh.Policy) || isRecord(fresh.Configuration)) {
    return isRecord(fresh.Policy) || stored.Policy === undefined ? fresh : { ...fresh, Policy: stored.Policy };
  }
  return typeof fresh.Name === "string" ? { ...stored, Name: fresh.Name } : stored;
}

const listeners = new Set<() => void>();

/** Abonnement aux réécritures du profil (pour `useSyncExternalStore`). */
export function subscribeStoredUser(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Horodatages que Jellyfin avance au fil des requêtes : ils ne font pas un profil neuf. */
const VOLATILE_FIELDS = ["LastActivityDate", "LastLoginDate"] as const;

function withoutVolatile(user: StoredUser): string {
  const copy: Record<string, unknown> = { ...user };
  for (const field of VOLATILE_FIELDS) delete copy[field];
  return JSON.stringify(copy);
}

/**
 * Adopte une relecture : écrit le profil fusionné et prévient les abonnés,
 * mais SEULEMENT si ce qui compte a changé. Les extensions reconstruisent leur
 * page depuis la chaîne `tentacle_user` (`PluginWebView`) : la réécrire pour
 * un simple horodatage les rechargerait à chaque retour au premier plan.
 * Vrai si l'étiquette de la photo a changé — la copie locale (`avatarCache`)
 * est alors à refaire.
 */
export function adoptFreshUser(storage: ProfileStorage, fresh: unknown): boolean {
  const stored = parseStoredUser(storage.getItem(STORED_USER_KEY));
  const merged = mergeFreshUser(stored, fresh);
  if (stored === null || merged === null) return false;
  if (withoutVolatile(merged) !== withoutVolatile(stored)) {
    storage.setItem(STORED_USER_KEY, JSON.stringify(merged));
    for (const listener of listeners) listener();
  }
  return (merged.PrimaryImageTag ?? null) !== (stored.PrimaryImageTag ?? null);
}

/** Ce que la relecture demande au client Jellyfin (`JellyfinClient.fetch`). */
export interface ProfileReader {
  fetch(path: string, init: undefined, opts: { noAuthExpiry: boolean }): Promise<unknown>;
}

/** Numéro de la dernière relecture partie : une réponse doublée par une plus récente est jetée. */
let latestRefresh = 0;
let lastRefreshAt = Number.NEGATIVE_INFINITY;

/**
 * Relit le profil et l'adopte ; vrai si la photo a changé. Ne rejette
 * jamais : hors ligne ou sur un refus, le profil stocké reste tel quel.
 *
 * `Users/Me`, jamais `Users/{id}` : le proxy refuse le second (403). Une
 * relecture ne compte pas dans le seuil d'expiration du jeton, dont
 * `useAuthRefresh` reste seul juge.
 *
 * `minIntervalMs` espace les relectures de confort (le premier plan) ; sans
 * lui, la relecture part toujours. Une relecture lancée APRÈS une autre la
 * rend caduque : la réponse d'avant un envoi de photo, arrivée en retard,
 * rétablirait l'ancienne étiquette.
 */
export async function refreshStoredUser(
  storage: ProfileStorage,
  client: ProfileReader,
  options: { minIntervalMs?: number } = {},
): Promise<boolean> {
  const now = Date.now();
  if (options.minIntervalMs !== undefined && now - lastRefreshAt < options.minIntervalMs) return false;
  lastRefreshAt = now;
  const ticket = ++latestRefresh;
  try {
    const fresh = await client.fetch("/Users/Me", undefined, { noAuthExpiry: true });
    return ticket === latestRefresh && adoptFreshUser(storage, fresh);
  } catch {
    return false;
  }
}

/**
 * L'URL de la photo, adressée par son étiquette : une photo changée change
 * d'URL, et le cache disque d'expo-image ne peut plus resservir l'ancienne.
 * `null` sans photo ou sans serveur.
 */
export function profilePhotoUrl(serverUrl: string, userId: string, tag: string | null | undefined): string | null {
  if (!serverUrl || !tag) return null;
  return `${serverUrl}/api/jellyfin/Users/${encodeURIComponent(userId)}/Images/Primary?tag=${encodeURIComponent(tag)}&quality=90&maxWidth=200`;
}
