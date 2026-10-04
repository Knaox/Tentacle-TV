import { getPrisma, hasPrisma } from "../db";
import { getFamilySwitches } from "./familyConfig";
import { findFamily, fold, jellyfinUserMap } from "./familyStore";

/**
 * La délégation « agit pour » (Famille v2) — un mécanisme GÉNÉRIQUE du cœur,
 * sans rien de propre à une extension. Un INVITÉ à qui le propriétaire a
 * donné le droit « peut demander » (`canRequestTitles`) se présente aux
 * routes d'EXTENSION — et à elles seules — sous l'identité du PROPRIÉTAIRE de
 * sa famille : ce que l'extension y fait (une demande de film), elle le fait
 * pour le propriétaire. Partout ailleurs, l'invité reste lui-même, avec son
 * périmètre (`profileSessionLimits.ts`).
 *
 * Ce que l'extension reçoit dans `request.user` : `{ userId, username }` du
 * propriétaire, `isAdmin: false` QUOI QU'IL ARRIVE (un propriétaire
 * administrateur ne prête jamais ce titre), `session: "tvProfile"`, et
 * `delegatedBy: { userId, username }` — l'invité, pour qui veut le dire.
 *
 * Lu en base à CHAQUE requête : retirer le droit coupe à l'appel suivant.
 */

export interface ExtensionIdentity {
  userId: string;
  username: string;
  isAdmin: false;
}

/** Le chemin des extensions : le cœur (`/active`, `/:id/bundle`) et les routes
 *  de chaque extension (`/api/plugins/<id>/…`). */
export const EXTENSIONS_PREFIX = "/api/plugins";

/**
 * Pour une session de profil sur une route d'extension : `null` si ce n'est
 * pas un invité (un membre garde SON identité), `"denied"` pour un invité sans
 * le droit (aucune extension), sinon l'identité du propriétaire à présenter.
 */
export async function extensionDelegate(userId: string): Promise<ExtensionIdentity | "denied" | null> {
  if (!hasPrisma()) return null;
  const row = await getPrisma().familyMember.findUnique({ where: { userId } });
  if (!row || row.kind !== "guest") return null;
  const switches = getFamilySwitches();
  if (row.canRequestTitles !== true || !switches.families || !switches.guests) return "denied";
  const family = await findFamily(row.familyId);
  if (!family) return "denied";
  const owner = (await jellyfinUserMap())?.get(fold(family.ownerUserId));
  if (owner?.isDisabled) return "denied";
  return { userId: family.ownerUserId, username: owner?.name ?? family.ownerName, isAdmin: false };
}
