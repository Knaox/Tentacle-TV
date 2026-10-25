import { jellyfinAdminFetch } from "../../../services/jellyfinAdminFetch";
import { guestExtensionAccess } from "../../../services/family/familyGuestExtensions";
import { isFamilyGuest } from "../../../services/family/familyGuestMarkers";
import type { HostApi } from "../pluginServerRuntime";
import { getInstalled } from "../../../services/pluginManager";
import { isPluginUsable } from "../../../services/pluginStorage/gate";
import { HostCallFailure } from "../hostDispatcher";
import { runtimeServices } from "../hostServices";
import { hasOctaveAccess } from "../../../services/octaveRights/octaveAccess";

/**
 * `users.rights` : ce qu'un compte peut faire avec CETTE extension, décidé par
 * l'hôte — jamais par l'invité :
 * - Jellyfin : le compte existe, n'est pas désactivé, et VOIT la bibliothèque
 *   musique (`EnableAllFolders` ou elle dans `EnabledFolders`) ;
 * - la Famille (CLAUDE.md) : un invité n'a d'extension qu'avec « peut demander »,
 *   que seul le propriétaire donne (`guestExtensionAccess`) ; sans lui, rien ;
 * - le cœur : l'extension sert (installée, activée, pas refusée) et son
 *   intégration est allumée par l'administrateur (`configEnabled`) ;
 * - « Accès à Octave » (`octave.rights`, droit Tentacle du compte ; un invité
 *   vaut son créateur) : sans lui, l'extension de musique ne le sert pas.
 * `canRequest` (garder hors bibliothèque, demander) suit `canUse` — un invité
 * qui l'a reçu agit à SON nom. `familyGuest` le dit à l'extension, qui peut
 * en faire moins (une extension de musique n'y fait jamais rien entrer).
 * `keepOffline` (garder hors ligne sur l'appareil) suit en plus
 * `EnableContentDownloading`, et n'est jamais celui d'un invité.
 */

interface RawUser {
  Id?: string;
  Policy?: { IsAdministrator?: boolean; IsDisabled?: boolean; EnableAllFolders?: boolean; EnabledFolders?: string[]; EnableContentDownloading?: boolean };
}

export async function userRights(pluginId: string, userId: string): Promise<Required<HostApi["users.rights"]["result"]>> {
  const res = await jellyfinAdminFetch<RawUser>(`/Users/${encodeURIComponent(userId)}`);
  if (!res.ok) {
    if (res.status === 404 || res.status === 400) return { exists: false, isAdmin: false, canUse: false, canRequest: false, familyGuest: false, keepOffline: false };
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
  let familyGuest: boolean;
  try {
    familyOk = (await guestExtensionAccess(userId)) !== "denied";
    familyGuest = await isFamilyGuest(userId);
  } catch {
    // Base muette : fermé à l'échec, comme `requireAuth` — et tenu pour un invité.
    familyOk = false;
    familyGuest = true;
  }
  const canUse = pluginOn && policy.IsDisabled !== true && seesMusic && familyOk && (await hasOctaveAccess(userId));
  // Garder hors ligne (`offline.music`) : le droit Jellyfin du compte ; un invité de la Famille, jamais.
  const keepOffline = canUse && !familyGuest && policy.EnableContentDownloading === true;
  return { exists: true, isAdmin, canUse, canRequest: canUse, familyGuest, keepOffline };
}
