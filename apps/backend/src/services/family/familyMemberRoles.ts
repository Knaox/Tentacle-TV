import { getPrisma } from "../db";
import type { MemberRoleDto, SetMemberRoleBody } from "../../family/familyRoles";
import { refuseReviewAccount } from "./familyConfig";
import { FamilyFailure } from "./familyErrors";
import type { Actor } from "./familyInvitations";
import { withFamilyLock } from "./familyLock";
import { notifyFamily } from "./familyNotify";
import { familyOf, familyProfiles, fold, ownerRefusal } from "./familyStore";
import { readMemberParental } from "./memberParentalStore";

/**
 * Le rôle de PARENT (docs/FAMILLE.md, « Les rôles ») : le propriétaire — lui seul — le
 * donne à un membre, et le lui retire. Un parent gère les enfants de la famille : tous
 * les invités (droits, photo, PIN, contrôle parental, suppression) et le contrôle
 * parental des membres mineurs ; il crée des invités si l'administration le lui permet.
 * Jamais un membre sous contrôle parental : le retirer d'abord.
 */
export async function setMemberRole(owner: Actor, memberUserId: string, body: SetMemberRoleBody): Promise<MemberRoleDto> {
  await refuseReviewAccount(owner.userId);
  const mine = await familyOf(owner.userId);
  if (mine?.role !== "owner") throw await ownerRefusal(owner.userId, memberUserId);
  const family = mine.family;
  const updated = await withFamilyLock(owner.userId, async () => {
    const row = (await familyProfiles(family.id)).find((entry) => fold(entry.userId) === fold(memberUserId));
    if (!row || row.kind !== "member") throw await ownerRefusal(owner.userId, memberUserId);
    if (body.parent && (await readMemberParental(row.userId))?.controls) {
      throw new FamilyFailure("family.member_parental_refused", "Un membre sous contrôle parental ne devient pas parent");
    }
    if ((row.isParent === true) === body.parent) return row;
    return getPrisma().familyMember.update({ where: { id: row.id }, data: { isParent: body.parent } });
  });
  await notifyFamily(family.id);
  console.log(`[family] Un membre ${updated.isParent ? "nommé parent" : "n'est plus parent"} dans la famille ${family.id}`);
  return { parent: updated.isParent === true };
}
