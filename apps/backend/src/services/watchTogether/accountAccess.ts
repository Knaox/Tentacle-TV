import { onContentPolicyInvalidated } from "../contentPolicy";
import { getJellyfinUsers, invalidateJellyfinUsers, type CachedJellyfinUser } from "./usersCache";
import { wtAccessFromSyncPlay, type WtAccess } from "./watchTogetherAccess";

/**
 * Watch Together face au droit `SyncPlayAccess` de chaque compte
 * (docs/DROITS-UTILISATEURS.md § 9.2). Jellyfin fait foi : la liste des comptes
 * (`/Users`, clé d'administration) porte la politique de chacun ; une seule
 * lecture sert tous les comptes, gardée 30 s (`usersCache.ts`), oubliée à
 * chaque écriture de politique faite par Tentacle.
 *
 * FERMÉ À L'ÉCHEC pour ce qui OUVRE (créer, inviter, entrer) : Jellyfin muet,
 * compte inconnu → `none`. Jamais pour ce qui FERME : on ne sort un membre de
 * son salon que sur une politique LUE qui dit « Interdit » — une panne de
 * Jellyfin ne vide pas les salons.
 */

const key = (userId: string) => userId.replace(/-/g, "").toLowerCase();

/** Le compte dans la liste lue (identifiants comparés sans tirets ni casse). */
export function findAccount(users: readonly CachedJellyfinUser[], userId: string): CachedJellyfinUser | null {
  const wanted = key(userId);
  return users.find((user) => key(user.id) === wanted) ?? null;
}

/** L'accès d'un compte lu dans une liste — absent : le plus fermé. */
export function accessIn(users: readonly CachedJellyfinUser[] | null, userId: string): WtAccess {
  const account = users ? findAccount(users, userId) : null;
  return account ? wtAccessFromSyncPlay(account.syncPlayAccess) : "none";
}

/** L'accès d'un compte à Watch Together — jamais une exception. */
export async function wtAccessOf(userId: string): Promise<WtAccess> {
  try {
    return accessIn(await getJellyfinUsers(), userId);
  } catch {
    return "none";
  }
}

/**
 * Les membres à sortir : ceux dont la politique LUE dit « Interdit ». Un compte
 * absent de la liste (supprimé) sort aussi ; une liste illisible ne sort personne.
 */
export function revokedMembers(users: readonly CachedJellyfinUser[] | null, memberIds: readonly string[]): string[] {
  if (!users) return [];
  return memberIds.filter((userId) => accessIn(users, userId) === "none");
}

/** Une écriture de politique faite par Tentacle : la liste des comptes est relue au prochain besoin. */
let unsubscribe: (() => void) | null = null;
export function forgetAccessOnPolicyWrites(onChange: (userId: string | null) => void): void {
  unsubscribe?.();
  unsubscribe = onContentPolicyInvalidated((userId) => {
    invalidateJellyfinUsers();
    onChange(userId);
  });
}
