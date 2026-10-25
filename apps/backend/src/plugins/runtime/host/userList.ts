import { jellyfinAdminFetch } from "../../../services/jellyfinAdminFetch";
import { withoutFamilyGuests } from "../../../services/family/familyGuestMarkers";
import { HostCallFailure } from "../hostDispatcher";
import type { HostApi } from "../pluginServerRuntime";

/**
 * `users.list` : les comptes du serveur, pour qu'une extension règle ses droits
 * par compte (son administration). Jellyfin fait foi ; les comptes désactivés
 * n'y paraissent pas, ni les invités de la Famille (`withoutFamilyGuests`, la
 * SEULE source : un invité n'apparaît dans aucune liste). Ni mot de passe, ni
 * politique : un identifiant, un nom, « administrateur ». Une base muette lève
 * (une liste qui ne peut pas écarter les invités ne se rend pas).
 */

interface RawUser {
  Id?: string;
  Name?: string;
  Policy?: { IsAdministrator?: boolean; IsDisabled?: boolean };
}

export async function userList(): Promise<HostApi["users.list"]["result"]> {
  const res = await jellyfinAdminFetch<RawUser[]>("/Users");
  if (!res.ok || !Array.isArray(res.data)) throw new HostCallFailure("unavailable", "Jellyfin ne répond pas");
  const users = res.data
    .filter((u): u is RawUser & { Id: string } => typeof u.Id === "string" && u.Id.length > 0 && u.Policy?.IsDisabled !== true)
    .map((u) => ({ userId: u.Id, name: typeof u.Name === "string" ? u.Name : "", isAdmin: u.Policy?.IsAdministrator === true }));
  try {
    return (await withoutFamilyGuests(users, (u) => u.userId)).sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    throw new HostCallFailure("unavailable", "comptes de la Famille illisibles");
  }
}
