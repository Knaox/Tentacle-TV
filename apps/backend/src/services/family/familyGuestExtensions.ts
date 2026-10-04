import { getPrisma, hasPrisma } from "../db";
import { getFamilySwitches } from "./familyConfig";

/**
 * Un invité et les extensions (Famille v2 ; correction de Damien du
 * 2026-10-04) : un INVITÉ à qui le propriétaire a donné « peut demander »
 * (`canRequestTitles`) utilise les routes d'EXTENSION — et elles seules — À
 * SON PROPRE NOM ; sans ce droit, aucune. Mécanisme GÉNÉRIQUE du cœur, sans
 * rien de propre à une extension, et aucune délégation : personne n'agit pour
 * un autre.
 *
 * Ce que l'extension reçoit dans `request.user` : l'invité lui-même — son
 * identifiant Jellyfin, `isAdmin: false`, `session: "tvProfile"` — et pour
 * nom celui de son COMPTE Jellyfin (« Zoe - invite de Damien ») : unique et
 * stable, quand le prénom du profil (« Zoé ») peut être celui d'un autre
 * compte, présent ou disparu. Lu en base à CHAQUE requête : retirer le droit
 * coupe à l'appel suivant.
 */

/** Le chemin des extensions : le cœur (`/active`, `/:id/bundle`) et les routes
 *  de chaque extension (`/api/plugins/<id>/…`). */
export const EXTENSIONS_PREFIX = "/api/plugins";

/**
 * Pour une session de profil sur une route d'extension : `null` si ce n'est
 * pas un invité (un membre y est lui-même, comme toujours), `"denied"` pour un
 * invité sans le droit, sinon le nom de compte à présenter.
 */
export async function guestExtensionAccess(userId: string): Promise<{ accountName: string | null } | "denied" | null> {
  if (!hasPrisma()) return null;
  const row = await getPrisma().familyMember.findUnique({ where: { userId } });
  if (!row || row.kind !== "guest") return null;
  const switches = getFamilySwitches();
  if (row.canRequestTitles !== true || !switches.families || !switches.guests) return "denied";
  return { accountName: row.jellyfinName };
}
