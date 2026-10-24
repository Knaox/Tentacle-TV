import { jellyfinAdminFetch } from "../../../services/jellyfinAdminFetch";
import { guestExtensionAccess } from "../../../services/family/familyGuestExtensions";
import { getInstalled } from "../../../services/pluginManager";
import { isPluginUsable } from "../../../services/pluginStorage/gate";
import { HostCallFailure } from "../hostDispatcher";
import { runtimeServices } from "../hostServices";

/**
 * `users.rights` : ce qu'un compte peut faire avec CETTE extension, décidé par
 * l'hôte — jamais par l'invité :
 * - Jellyfin : le compte existe, n'est pas désactivé, et VOIT la bibliothèque
 *   musique (`EnableAllFolders` ou elle dans `EnabledFolders`) ;
 * - la Famille (CLAUDE.md) : un invité n'a d'extension qu'avec « peut demander »,
 *   que seul le propriétaire donne (`guestExtensionAccess`) ; sans lui, rien ;
 * - le cœur : l'extension sert (installée, activée, pas refusée) et son
 *   intégration est allumée par l'administrateur (`configEnabled`).
 * `canRequest` (garder hors bibliothèque, demander) suit `canUse` — un invité
 * qui l'a reçu agit à SON nom.
 */

interface RawUser {
  Id?: string;
  Policy?: { IsAdministrator?: boolean; IsDisabled?: boolean; EnableAllFolders?: boolean; EnabledFolders?: string[] };
}

export async function userRights(pluginId: string, userId: string): Promise<{ exists: boolean; isAdmin: boolean; canUse: boolean; canRequest: boolean }> {
  const res = await jellyfinAdminFetch<RawUser>(`/Users/${encodeURIComponent(userId)}`);
  if (!res.ok) {
    if (res.status === 404 || res.status === 400) return { exists: false, isAdmin: false, canUse: false, canRequest: false };
    throw new HostCallFailure("unavailable", "Jellyfin ne répond pas");
  }
  const policy = res.data.Policy ?? {};
  const isAdmin = policy.IsAdministrator === true;
  const plugin = getInstalled().find((p) => p.pluginId === pluginId);
  const pluginOn = !!plugin && isPluginUsable(plugin) && (plugin.config as Record<string, unknown>)?.enabled === true;
  // La bibliothèque musique dédiée, telle que la tient la musique du cœur ; sans elle, rien n'est permis.
  const lib = await runtimeServices().jellyfin?.musicLibrary({}).catch(() => null) ?? null;
  const seesMusic = !!lib && (policy.EnableAllFolders === true || (policy.EnabledFolders ?? []).includes(lib.libraryId));
  let familyOk: boolean;
  try {
    familyOk = (await guestExtensionAccess(userId)) !== "denied";
  } catch {
    // Base muette : fermé à l'échec, comme `requireAuth`.
    familyOk = false;
  }
  const canUse = pluginOn && policy.IsDisabled !== true && seesMusic && familyOk;
  return { exists: true, isAdmin, canUse, canRequest: canUse };
}
